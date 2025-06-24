---

## 🛠️ Configuración y ejecución del proyecto

### 1. Crear un entorno virtual

```bash
virtualenv venv
```

### 2. Activar el entorno virtual

* En **Windows**:

  ```bash
  venv\Scripts\activate
  ```
* En **Mac/Linux**:

  ```bash
  source venv/bin/activate
  ```

### 3. Instalar dependencias del proyecto

```bash
pip install -r requirements.txt
```

### 4. Aplicar migraciones (OPCIONAL YA ESTA CARGADO)

```bash
python manage.py makemigrations
python manage.py makemigrations notification
python manage.py migrate
```

### 5. Limpiar permisos Y TRADUCIRLOS (si es necesario)

```bash
python manage.py clean_permissions --force
python manage.py translate_permissions

```

### 6. Crear superusuario para acceder al panel de administración

```bash
python manage.py createsuperuser
```

### 7. Ejecutar servidor ASGI con Daphne (incluye WebSocket para notificaciones)

```bash
daphne -b 127.0.0.1 -p 8081 config.asgi:application
```

### 8. Ejecutar servidor de desarrollo (sin WebSocket, sin notificaciones)

```bash
python manage.py runserver 8080
```

---

## 🧊 Congelar dependencias (opcional pero recomendado)

Después de instalar o actualizar paquetes, puedes actualizar tu archivo `requirements.txt` con:

```bash
pip freeze > requirements.txt
```
