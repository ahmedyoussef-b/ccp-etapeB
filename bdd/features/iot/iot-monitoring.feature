#language: fr
Fonctionnalité: Monitoring IoT et capteurs
  En tant que superviseur ou chef de bloc
  Je veux surveiller les capteurs et contrôler les actionneurs
  Afin de maintenir la sécurité des installations

  Contexte:
    Étant donné je suis connecté en tant que "superviseur"
    Et des capteurs sont installés sur le site

  Scénario: Visualisation des lectures des capteurs
    Quand je clique sur "Monitoring IoT"
    Alors je vois la liste des capteurs actifs
    Et chaque capteur affiche sa dernière lecture

  Scénario: Alerte de seuil dépassé
    Étant donné un capteur de température "Salle serveur"
    Quand la température dépasse le seuil de 30°C
    Alors une alerte s'affiche sur le dashboard
    Et je reçois une notification

  Scénario: Contrôle d'un actionneur
    Étant donné un actionneur "Ventilation salle serveur"
    Quand je clique sur "Activer"
    Alors l'actionneur passe en position "On"
    Et le statut est mis à jour en temps réel

  Scénario: Historique des données
    Étant donné un capteur de fumée
    Quand je clique sur "Historique"
    Et je sélectionne la période "7 derniers jours"
    Alors je vois le graphique des données

  Scénario: Déconnexion d'un capteur
    Étant donné un capteur connecté
    Quand le capteur perd la connexion
    Alors le statut passe à "Déconnecté"
    Une alerte de maintenance est créée
