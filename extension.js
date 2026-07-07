import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

function runCommand(command) {
    try {
        const [, stdout, stderr, status] = GLib.spawn_command_line_sync(command);
        if (status === 0) {
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(stdout).trim();
        }
        return null;
    } catch (e) {
        console.error(e);
        return null;
    }
}

const DnsToggle = GObject.registerClass(
class DnsToggle extends QuickSettings.QuickMenuToggle {
    constructor(extension) {
        super({
            title: 'DNS Switcher',
            iconName: 'network-server-symbolic',
        });
        this._extension = extension;
        this._settings = extension.getSettings();
        
        this.menu.setHeader('network-server-symbolic', 'DNS Servers', 'Select an active DNS server');

        // Listen for settings changes to rebuild menu
        this._settingsChangedId = this._settings.connect('changed', this._buildMenu.bind(this));
        
        this._buildMenu();
    }

    _buildMenu() {
        this.menu.removeAll();

        let serversJSON = this._settings.get_string('dns-servers');
        let servers = [];
        try {
            servers = JSON.parse(serversJSON);
        } catch (e) {
            console.error(e);
        }

        let activeDns = this._settings.get_string('active-dns');

        let defaultItem = new PopupMenu.PopupMenuItem('System Default');
        if (activeDns === '') {
            defaultItem.setOrnament(PopupMenu.Ornament.DOT);
        }
        defaultItem.connect('activate', () => {
            this._setDns('', 'System Default');
        });
        this.menu.addMenuItem(defaultItem);

        servers.filter(s => s.visible !== false).forEach(server => {
            let item = new PopupMenu.PopupMenuItem(server.name);
            if (activeDns === server.ip) {
                item.setOrnament(PopupMenu.Ornament.DOT);
            }
            item.connect('activate', () => {
                this._setDns(server.ip, server.name);
            });
            this.menu.addMenuItem(item);
        });

        // Add settings shortcut
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let settingsItem = new PopupMenu.PopupMenuItem('Extension Settings');
        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
            Main.panel.closeCalendar(); // close quick settings menu
        });
        this.menu.addMenuItem(settingsItem);
    }

    _setDns(ip, name) {
        let interfaceName = this._settings.get_string('network-interface');
        
        if (!interfaceName) {
            let activeConns = runCommand('nmcli -t -f NAME,TYPE,DEVICE connection show --active');
            if (activeConns) {
                let lines = activeConns.split('\n');
                for (let line of lines) {
                    let parts = line.split(':');
                    if (parts.length >= 3 && (parts[1] === '802-11-wireless' || parts[1] === '802-3-ethernet' || parts[1] === 'wifi')) {
                        interfaceName = parts[0];
                        break;
                    }
                }
            }
        }

        if (!interfaceName) {
            Main.notify('DNS Switcher Error', 'Could not detect active network interface.');
            return;
        }

        if (ip === '') {
            runCommand(`nmcli connection modify "${interfaceName}" ipv4.ignore-auto-dns no ipv4.dns ""`);
        } else {
            runCommand(`nmcli connection modify "${interfaceName}" ipv4.ignore-auto-dns yes ipv4.dns "${ip}"`);
        }
        
        runCommand(`nmcli connection up "${interfaceName}"`);
        
        this._settings.set_string('active-dns', ip);
        Main.notify('DNS Switched', `DNS set to ${name}`);
        this._buildMenu();
    }

    destroy() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        super.destroy();
    }
});

const VpnToggle = GObject.registerClass(
class VpnToggle extends QuickSettings.QuickToggle {
    constructor(extension) {
        super({
            title: 'VPN',
            iconName: 'network-vpn-symbolic',
            toggleMode: true
        });
        this._extension = extension;
        this._settings = extension.getSettings();
        this._wasConnectedByUs = false;
        this._monitorId = null;
        
        let vpnName = this._settings.get_string('vpn-config-path');
        let activeConns = runCommand('nmcli -t -f NAME,TYPE connection show --active');
        if (activeConns && vpnName && activeConns.includes(vpnName)) {
            this.checked = true;
            this.title = 'VPN Connected';
            this._startUsageMonitor(vpnName);
        } else {
            this.checked = false;
            this.title = 'VPN Disconnected';
        }
        
        this.connect('clicked', () => this._onClicked());
    }
    
    _startUsageMonitor(vpnName) {
        if (this._monitorId) return;
        
        this._monitorId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            let activeConns = runCommand('nmcli -t -f NAME,DEVICE connection show --active');
            let iface = null;
            if (activeConns) {
                let lines = activeConns.split('\n');
                for (let line of lines) {
                    if (line.startsWith(vpnName + ':')) {
                        iface = line.split(':')[1];
                        break;
                    }
                }
            }
            
            if (!iface) {
                // VPN dropped
                this._stopUsageMonitor();
                this.checked = false;
                this.title = 'VPN Disconnected';
                this.subtitle = '';
                
                if (this._settings.get_boolean('vpn-auto-reconnect') && this._wasConnectedByUs) {
                    Main.notify('VPN Dropped', 'Attempting to reconnect...');
                    runCommand(`nmcli connection up "${vpnName}"`);
                    // re-check next tick
                    this.checked = true;
                    this._startUsageMonitor(vpnName);
                }
                return GLib.SOURCE_REMOVE;
            }
            
            // Read stats
            try {
                let rxStr = runCommand(`cat /sys/class/net/${iface}/statistics/rx_bytes`);
                let txStr = runCommand(`cat /sys/class/net/${iface}/statistics/tx_bytes`);
                let rx = parseInt(rxStr) || 0;
                let tx = parseInt(txStr) || 0;
                
                let formatBytes = (bytes) => {
                    if (bytes < 1024) return bytes + ' B';
                    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
                    return (bytes / 1048576).toFixed(1) + ' MB';
                };
                
                this.subtitle = `↓ ${formatBytes(rx)}  ↑ ${formatBytes(tx)}`;
            } catch (e) {}
            
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopUsageMonitor() {
        if (this._monitorId) {
            GLib.source_remove(this._monitorId);
            this._monitorId = null;
        }
    }

    _onClicked() {
        let vpnName = this._settings.get_string('vpn-config-path');
        if (!vpnName) {
            Main.notify('VPN Error', 'No VPN connection name set.');
            this.checked = false;
            return;
        }
        
        if (this.checked) {
            if (this._settings.get_boolean('vpn-dns-leak-protection')) {
                runCommand(`nmcli connection modify "${vpnName}" ipv4.dns-search "~." ipv4.dns-priority -50`);
            }
            runCommand(`nmcli connection up "${vpnName}"`);
            Main.notify('VPN connected', `Connected to ${vpnName}`);
            this.title = 'VPN Connected';
            this._wasConnectedByUs = true;
            this._startUsageMonitor(vpnName);
        } else {
            this._wasConnectedByUs = false;
            this._stopUsageMonitor();
            runCommand(`nmcli connection down "${vpnName}"`);
            Main.notify('VPN disconnected', `Disconnected from ${vpnName}`);
            this.title = 'VPN Disconnected';
            this.subtitle = '';
        }
    }

    destroy() {
        this._stopUsageMonitor();
        super.destroy();
    }
});

const DnsVpnIndicator = GObject.registerClass(
class DnsVpnIndicator extends QuickSettings.SystemIndicator {
    constructor(extension) {
        super();
        this._extension = extension;
        this.quickSettingsItems = [];

        this._dnsToggle = new DnsToggle(extension);
        this.quickSettingsItems.push(this._dnsToggle);
        
        if (extension.getSettings().get_boolean('vpn-enabled')) {
            this._vpnToggle = new VpnToggle(extension);
            this.quickSettingsItems.push(this._vpnToggle);
        }
    }
});

export default class DnsVpnSwitcherExtension extends Extension {
    enable() {
        this._indicator = new DnsVpnIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.quickSettingsItems.forEach(item => item.destroy());
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
