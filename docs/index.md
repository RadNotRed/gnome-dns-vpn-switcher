# DNS & VPN Switcher Documentation

Welcome to the documentation for the GNOME DNS & VPN Switcher extension!

## Setup Guide

### 1. Requirements
Ensure you are running a modern version of GNOME (45 or newer) on a Wayland or X11 session.

### 2. VPN Support
To use the OpenVPN features, you must install the NetworkManager OpenVPN plugin.
- **Ubuntu/Debian**: `sudo apt install network-manager-openvpn-gnome`
- **Fedora**: `sudo dnf install NetworkManager-openvpn-gnome`

### 3. Bulk Importing DNS Servers
If you manage a custom list of DNS servers (e.g. for enterprise or ad-blocking), you can import them into the extension quickly instead of typing them out.

Create a `servers.json` file on your computer:
```json
[
  { "name": "AdGuard Family", "ip": "94.140.14.15,94.140.15.16", "visible": true },
  { "name": "CleanBrowsing", "ip": "185.228.168.9,185.228.169.9", "visible": true }
]
```

Then, open the extension settings, navigate to the **DNS Settings** tab, and click **Import**.

## Security Features

### DNS Leak Protection
When enabled, this feature modifies your active VPN profile using `nmcli` to set `ipv4.dns-search "~."` and `ipv4.dns-priority -50`. This tells `systemd-resolved` and NetworkManager to forcibly route *all* hostname resolutions through the VPN interface, ensuring your ISP cannot eavesdrop on your web traffic.
