# 🌐 GNOME DNS & VPN Switcher

<div align="center">
  <p>A beautiful, modern GNOME Shell Extension to switch your DNS servers and manage OpenVPN straight from your Quick Settings menu.</p>
</div>

## ✨ Features

- **🚀 Quick Settings Integration**: Seamlessly blends into the GNOME 45+ Quick Settings menu (ESM native).
- **🛡️ DNS Switcher**: Easily swap between Google, Cloudflare, OpenDNS, Quad9, AdGuard, and custom DNS servers instantly.
- **🔒 DNS Leak Protection**: Option to route all DNS queries strictly through the VPN interface when connected.
- **🔌 OpenVPN Support**: One-click toggling of NetworkManager OpenVPN connections.
- **📊 Live Data Usage**: Real-time stats (`↓ RX  ↑ TX`) displayed right in your panel while the VPN is active (with zero CPU footprint when disconnected).
- **🔁 Auto-Reconnect**: Automatically attempts to bring the VPN back up if it drops unexpectedly.
- **⚙️ JSON Importer**: Bulk import lists of custom DNS servers via a JSON file.

---

## 🛠️ Requirements

- **GNOME Shell**: 45, 46, 47+ (ESM architecture support)
- **OpenVPN integration**: Requires `NetworkManager-openvpn` plugin.

## 📦 Installation

### From GNOME Extensions
*(Coming soon once reviewed by GNOME Extensions!)*

### Manual Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/radnotred/gnome-dns-switcher.git
   cd gnome-dns-switcher
   ```
2. Build and install:
   ```bash
   gnome-extensions pack --extra-source=prefs.js --schema=schemas/org.gnome.shell.extensions.dns-vpn-switcher.gschema.xml --force
   gnome-extensions install --force dns-vpn-switcher@radnotred.dev.shell-extension.zip
   ```
3. Restart GNOME Shell (or log out and log back in on Wayland) and enable the extension!

## 🏗️ Technologies Used

- **GJS (GNOME JavaScript)**: Using the latest modern ESM syntax (`import`/`export`).
- **Libadwaita / GTK4**: For a sleek, modern preferences window.
- **NetworkManager (`nmcli`)**: Native background network handling without requiring root prompts for connection changes.

## 📄 License

This project is licensed under the **GPL-3.0 License**. See the `LICENSE` file for more details.
