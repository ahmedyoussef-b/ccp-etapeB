# NexaFlow Bridge Server

Serveur Python/FastAPI permettant de faire le lien entre l'application web NexaFlow et le matériel réel (ESP32, PLC, caméras IP, actionneurs, etc.).

## Installation

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate     # Windows

pip install -r requirements.txt
```

## Lancement

```bash
python main.py
```

Le serveur démarre sur `http://0.0.0.0:8080`.

## Endpoints

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/health` | Vérifie l'état du bridge |
| POST | `/api/actuator` | Commande un actionneur |
| GET | `/api/sensor` | Lecture d'un capteur |
| POST | `/api/sensor` | Écriture d'une valeur de capteur |
| GET | `/api/devices` | Liste des devices connus |
| WS | `/ws` | WebSocket pour communication temps réel |

## Intégration NexaFlow

1. Démarrer le bridge sur le poste de l'opérateur
2. Dans NexaFlow, aller sur `/devices`
3. Le badge **Bridge** s'affiche automatiquement si le serveur est détecté sur `localhost:8080`
4. Les commandes du Chat IA utiliseront le bridge si disponible

## Sécurité

- Le bridge écoute sur `0.0.0.0` pour le développement
- En production, restreindre les CORS et ajouter une authentification par token
- Ne jamais exposer le bridge directement sur Internet sans authentification
