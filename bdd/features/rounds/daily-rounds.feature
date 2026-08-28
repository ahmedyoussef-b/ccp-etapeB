#language: fr
Fonctionnalité: Gestion des rondes quotidiennes
  En tant que rondier
  Je veux effectuer mes rondes selon le planning
  Afin de surveiller les zones assignées

  Contexte:
    Étant donné je suis connecté en tant que "rondier"
    Et des rondes sont planifiées pour aujourd'hui

  Scénario: Consultation du planning des rondes
    Quand je clique sur "Mes rondes"
    Alors je vois la liste des rondes du jour
    Et chaque ronde affiche l'heure et la zone

  Scénario: Démarrage d'une ronde
    Étant donné une ronde planifiée à "Zone A"
    Quand je clique sur "Commencer la ronde"
    Alors le timer de la ronde démarre
    Et je vois la liste des points de contrôle

  Scénario: Validation des points de contrôle
    Étant donné que je suis en cours de ronde
    Quand j'arrive au point "Entrée principale"
    Et je scanne le QR code
    Alors le point est marqué comme visité
    Et l'heure de passage est enregistrée

  Scénario: Signalement d'incident pendant une ronde
    Étant donné que je suis en cours de ronde
    Quand je clique sur "Signaler un incident"
    Et je sélectionne le type "Sécurité"
    Et je choisis la gravité "Haute"
    Et je saisis la description "Porte forcée détectée"
    Et je clique sur "Envoyer"
    Alors l'incident est enregistré
    Et le chef de quart est alerté en temps réel

  Scénario: Finalisation d'une ronde
    Étant donné que j'ai visité tous les points de contrôle
    Quand je clique sur "Terminer la ronde"
    Alors la ronde est marquée comme "Complétée"
    Et le rapport de ronde est généré

  Scénario: Ronde en retard
    Étant donné une ronde prévue il y a plus de 30 minutes
    Alors je vois une alerte "Ronde en retard"
    Et le superviseur est notifié
