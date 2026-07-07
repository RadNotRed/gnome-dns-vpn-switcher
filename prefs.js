import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DnsVpnSwitcherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // DNS Page
        const dnsPage = new Adw.PreferencesPage({
            title: 'DNS Settings',
            icon_name: 'network-server-symbolic',
        });
        
        const interfaceGroup = new Adw.PreferencesGroup({
            title: 'Network Interface',
            description: 'Leave empty to try to auto-detect the active connection. Otherwise, specify the connection name (e.g. "Wired connection 1")',
        });
        const interfaceRow = new Adw.EntryRow({
            title: 'Target Network Connection Name',
            text: settings.get_string('network-interface'),
        });
        interfaceRow.connect('notify::text', () => {
            settings.set_string('network-interface', interfaceRow.text);
        });
        interfaceGroup.add(interfaceRow);
        dnsPage.add(interfaceGroup);

        const dnsGroup = new Adw.PreferencesGroup({
            title: 'DNS Servers',
            description: 'Manage your DNS servers. The active server can be toggled from the top panel.',
        });
        
        const importDnsRow = new Adw.ActionRow({
            title: 'Import DNS List (JSON)',
            subtitle: 'Load an array of DNS servers from a .json file'
        });
        const importDnsBtn = new Gtk.Button({ label: 'Import', valign: Gtk.Align.CENTER });
        importDnsBtn.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({ title: 'Select DNS JSON File' });
            
            const filter = new Gtk.FileFilter();
            filter.set_name('JSON Files');
            filter.add_pattern('*.json');
            
            const filters = Gio.ListStore.new(Gtk.FileFilter);
            filters.append(filter);
            dialog.set_filters(filters);

            dialog.open(window, null, (dlg, res) => {
                try {
                    const file = dlg.open_finish(res);
                    if (file) {
                        file.load_contents_async(null, (file_obj, res2) => {
                            try {
                                const [success, contents] = file_obj.load_contents_finish(res2);
                                if (success) {
                                    const decoder = new TextDecoder('utf-8');
                                    const jsonStr = decoder.decode(contents);
                                    const newServers = JSON.parse(jsonStr);
                                    if (Array.isArray(newServers)) {
                                        const currentStr = settings.get_string('dns-servers');
                                        let currentServers = [];
                                        try { currentServers = JSON.parse(currentStr); } catch (e) {}
                                        
                                        const combined = currentServers.concat(newServers);
                                        settings.set_string('dns-servers', JSON.stringify(combined));
                                        
                                        const msg = new Adw.MessageDialog({
                                            heading: 'Import Successful',
                                            body: `Added ${newServers.length} DNS servers.`,
                                        });
                                        msg.add_response('ok', 'OK');
                                        msg.present();
                                        
                                        this.refreshDnsList(dnsGroup, combined, settings);
                                    }
                                }
                            } catch (e) {
                                console.error('Failed to parse JSON', e);
                            }
                        });
                    }
                } catch (e) {
                    // User cancelled or error
                }
            });
        });
        importDnsRow.add_suffix(importDnsBtn);
        dnsGroup.add(importDnsRow);
        
        const serversJSON = settings.get_string('dns-servers');
        let servers = [];
        try {
            servers = JSON.parse(serversJSON);
        } catch (e) {
            console.error('Failed to parse DNS servers JSON');
        }

        this._serverRows = [];
        this._addRow = null;

        this.refreshDnsList(dnsGroup, servers, settings);
        dnsPage.add(dnsGroup);

        // VPN Page
        const vpnPage = new Adw.PreferencesPage({
            title: 'OpenVPN',
            icon_name: 'network-vpn-symbolic',
        });

        // 1. Instructions Group
        const installGroup = new Adw.PreferencesGroup({
            title: '1. Install NetworkManager Plugin',
            description: 'If you do not have the OpenVPN plugin, install it using your terminal:',
        });
        const fedoraRow = new Adw.ActionRow({ 
            title: 'Fedora / RHEL', 
            subtitle: 'sudo dnf install NetworkManager-openvpn-gnome',
            activatable: true 
        });
        fedoraRow.connect('activated', () => {
            const clipboard = window.get_display().get_clipboard();
            clipboard.set_text(fedoraRow.subtitle);
            window.add_toast(new Adw.Toast({ title: 'Copied Fedora command' }));
        });
        
        const debianRow = new Adw.ActionRow({ 
            title: 'Ubuntu / Debian', 
            subtitle: 'sudo apt install network-manager-openvpn-gnome',
            activatable: true 
        });
        debianRow.connect('activated', () => {
            const clipboard = window.get_display().get_clipboard();
            clipboard.set_text(debianRow.subtitle);
            window.add_toast(new Adw.Toast({ title: 'Copied Ubuntu command' }));
        });
        
        installGroup.add(fedoraRow);
        installGroup.add(debianRow);
        vpnPage.add(installGroup);

        // 2. Integration Group
        const vpnGroup = new Adw.PreferencesGroup({
            title: '2. OpenVPN Integration',
        });

        const importRow = new Adw.ActionRow({
            title: 'Import .ovpn Profile',
            subtitle: 'Select a file to automatically import it into NetworkManager'
        });
        const importBtn = new Gtk.Button({
            label: 'Select File',
            valign: Gtk.Align.CENTER
        });
        
        const vpnConfigRow = new Adw.EntryRow({
            title: 'NetworkManager VPN Connection Name',
            text: settings.get_string('vpn-config-path'),
        });
        
        importBtn.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({ title: 'Select OpenVPN Profile' });
            
            const filter = new Gtk.FileFilter();
            filter.set_name('OpenVPN Configs');
            filter.add_pattern('*.ovpn');
            
            const filters = Gio.ListStore.new(Gtk.FileFilter);
            filters.append(filter);
            dialog.set_filters(filters);

            dialog.open(window, null, (dlg, res) => {
                try {
                    const file = dlg.open_finish(res);
                    if (file) {
                        const path = file.get_path();
                        this.importVpnProfile(path, vpnConfigRow, settings);
                    }
                } catch (e) {
                    // User cancelled or error
                }
            });
        });
        importRow.add_suffix(importBtn);
        vpnGroup.add(importRow);

        const vpnEnabledRow = new Adw.SwitchRow({
            title: 'Enable VPN Switcher',
            active: settings.get_boolean('vpn-enabled'),
        });
        settings.bind('vpn-enabled', vpnEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        vpnGroup.add(vpnEnabledRow);
        
        vpnConfigRow.connect('notify::text', () => {
            settings.set_string('vpn-config-path', vpnConfigRow.text);
        });
        vpnGroup.add(vpnConfigRow);

        const vpnLeakRow = new Adw.SwitchRow({
            title: 'DNS Leak Protection',
            subtitle: 'Force all DNS traffic through VPN interface',
            active: settings.get_boolean('vpn-dns-leak-protection'),
        });
        settings.bind('vpn-dns-leak-protection', vpnLeakRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        vpnGroup.add(vpnLeakRow);
        
        const vpnAutoReconnectRow = new Adw.SwitchRow({
            title: 'Auto Reconnect',
            subtitle: 'Attempt to reconnect if the VPN drops unexpectedly',
            active: settings.get_boolean('vpn-auto-reconnect'),
        });
        settings.bind('vpn-auto-reconnect', vpnAutoReconnectRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        vpnGroup.add(vpnAutoReconnectRow);

        vpnPage.add(vpnGroup);

        window.add(dnsPage);
        window.add(vpnPage);
    }
    
    importVpnProfile(path, vpnConfigRow, settings) {
        try {
            // Import the VPN using nmcli
            const [, stdout, stderr, status] = GLib.spawn_command_line_sync(`nmcli connection import type openvpn file "${path}"`);
            if (status === 0) {
                // The output is usually: Connection 'Name' (uuid) successfully added.
                const decoder = new TextDecoder('utf-8');
                const outStr = decoder.decode(stdout);
                
                // Try to extract the name
                const match = outStr.match(/Connection '(.*?)'/);
                if (match && match[1]) {
                    vpnConfigRow.set_text(match[1]);
                    settings.set_string('vpn-config-path', match[1]);
                    
                    const dialog = new Adw.MessageDialog({
                        heading: 'Import Successful',
                        body: `Successfully imported as '${match[1]}'`,
                    });
                    dialog.add_response('ok', 'OK');
                    dialog.present();
                }
            } else {
                const decoder = new TextDecoder('utf-8');
                const errStr = decoder.decode(stderr);
                const dialog = new Adw.MessageDialog({
                    heading: 'Import Failed',
                    body: errStr || 'Unknown error occurred.',
                });
                dialog.add_response('ok', 'OK');
                dialog.present();
            }
        } catch (e) {
            console.error(e);
        }
    }

    refreshDnsList(group, servers, settings) {
        // Clear old rows explicitly
        if (this._serverRows) {
            this._serverRows.forEach(r => group.remove(r));
        }
        if (this._addRow) {
            group.remove(this._addRow);
        }
        this._serverRows = [];

        servers.forEach((server, index) => {
            const row = new Adw.ActionRow({
                title: server.name,
                subtitle: server.ip
            });
            
            const switchBtn = new Gtk.Switch({
                active: server.visible !== false,
                valign: Gtk.Align.CENTER
            });
            switchBtn.connect('notify::active', () => {
                servers[index].visible = switchBtn.active;
                settings.set_string('dns-servers', JSON.stringify(servers));
            });
            
            const delBtn = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER
            });
            delBtn.connect('clicked', () => {
                servers.splice(index, 1);
                settings.set_string('dns-servers', JSON.stringify(servers));
                this.refreshDnsList(group, servers, settings);
            });

            row.add_prefix(switchBtn);
            row.add_suffix(delBtn);
            
            this._serverRows.push(row);
            group.add(row);
        });
        
        this._addRow = this.createAddRow(group, servers, settings);
        group.add(this._addRow);
    }

    createAddRow(group, servers, settings) {
        const row = new Adw.ActionRow({ title: 'Add New Server' });
        const nameEntry = new Gtk.Entry({ placeholder_text: 'Name', valign: Gtk.Align.CENTER });
        const ipEntry = new Gtk.Entry({ placeholder_text: 'IP (comma separated)', valign: Gtk.Align.CENTER });
        const addButton = new Gtk.Button({ label: 'Add', valign: Gtk.Align.CENTER });
        
        addButton.connect('clicked', () => {
            if (nameEntry.get_text() && ipEntry.get_text()) {
                servers.push({
                    name: nameEntry.get_text(),
                    ip: ipEntry.get_text(),
                    visible: true
                });
                settings.set_string('dns-servers', JSON.stringify(servers));
                nameEntry.set_text('');
                ipEntry.set_text('');
                this.refreshDnsList(group, servers, settings);
            }
        });

        row.add_suffix(nameEntry);
        row.add_suffix(ipEntry);
        row.add_suffix(addButton);
        return row;
    }
}
