# Cloudflare Tunnel - Guía de Configuración

Esta guía explica cómo configurar Cloudflare Tunnel para exponer la aplicación en internet.

## Requisitos Previos

1. Cuenta de Cloudflare
2. Dominio configurado en Cloudflare
3. `cloudflared` instalado en el servidor

## Instalación de Cloudflare Tunnel

### 1. Instalar cloudflared

```bash
# Descargar e instalar
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### 2. Autenticar con Cloudflare

```bash
cloudflared tunnel login
```

Esto abrirá un navegador para autenticarte con tu cuenta de Cloudflare.

### 3. Crear un Túnel

```bash
cloudflared tunnel create criminalidad
```

Esto creará:
- Un túnel con un UUID único
- Un archivo de credenciales en `~/.cloudflared/UUID.json`

**Guarda el UUID del túnel**, lo necesitarás para la configuración.

### 4. Configurar el Túnel

Crear archivo de configuración `/etc/cloudflared/config.yml`:

```yaml
tunnel: YOUR_TUNNEL_UUID
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_UUID.json

ingress:
  - hostname: delitos.your-domain.com
    service: http://127.0.0.1:8001
  - service: http_status:404
```

**Reemplaza**:
- `YOUR_TUNNEL_UUID`: El UUID de tu túnel
- `YOUR_USERNAME`: Tu usuario del sistema
- `delitos.your-domain.com`: Tu dominio/subdominio

### 5. Configurar DNS en Cloudflare

1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Selecciona tu dominio
3. Ve a **DNS** → **Records**
4. Añade un registro CNAME:
   - **Type**: CNAME
   - **Name**: delitos (o tu subdominio)
   - **Target**: `YOUR_TUNNEL_UUID.cfargotunnel.com`
   - **Proxy status**: Proxied (naranja) ☁️

### 6. Iniciar el Túnel como Servicio

Crear `/etc/systemd/system/cloudflared.service`:

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/cloudflared --no-autoupdate --config /etc/cloudflared/config.yml tunnel run
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Activar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

## Verificar Configuración

```bash
# Ver túneles activos
cloudflared tunnel list

# Ver estado del servicio
sudo systemctl status cloudflared

# Ver logs
sudo journalctl -u cloudflared -f
```

## Múltiples Servicios (Opcional)

Si tienes varios servicios, puedes configurar múltiples hostname en el mismo túnel:

```yaml
tunnel: YOUR_TUNNEL_UUID
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_UUID.json

ingress:
  - hostname: app1.your-domain.com
    service: http://127.0.0.1:3000
  - hostname: delitos.your-domain.com
    service: http://127.0.0.1:8001
  - hostname: app3.your-domain.com
    service: http://127.0.0.1:5000
  - service: http_status:404
```

## Troubleshooting

### El túnel no conecta

```bash
# Ver logs detallados
sudo journalctl -u cloudflared -f

# Verificar configuración
cloudflared tunnel info YOUR_TUNNEL_UUID

# Probar manualmente
cloudflared --config /etc/cloudflared/config.yml tunnel run
```

### Error "tunnel not found"

Verifica que el UUID en `config.yml` coincide con tu túnel:

```bash
cloudflared tunnel list
```

### DNS no resuelve

1. Verifica el registro CNAME en Cloudflare Dashboard
2. Espera unos minutos para la propagación DNS
3. Verifica con: `nslookup delitos.your-domain.com`

## Seguridad

### ⚠️ Archivos Sensibles

**NUNCA** subas a GitHub:
- `~/.cloudflared/*.json` (credenciales del túnel)
- `/etc/cloudflared/config.yml` (puede contener UUIDs sensibles)

Estos archivos están incluidos en `.gitignore`.

### Buenas Prácticas

1. Usa HTTPS (Cloudflare lo activa automáticamente)
2. Configura Cloudflare WAF para protección adicional
3. Activa Cloudflare Access si necesitas autenticación
4. Revisa los logs regularmente

## Referencias

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflared GitHub](https://github.com/cloudflare/cloudflared)
