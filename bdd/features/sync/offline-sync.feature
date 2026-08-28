#language: fr
Fonctionnalité: Synchronisation et mode hors-ligne
  En tant qu'utilisateur
  Je veux pouvoir travailler hors-ligne
  Afin de continuer mes activités sans connexion

  Contexte:
    Étant donné je suis connecté en tant que "rondier"
    Et j'ai des données en cache local

  Scénario: Passage en mode hors-ligne
    Quand la connexion internet est perdue
    Alors l'application passe en mode hors-ligne
    Et un indicateur "Hors-ligne" s'affiche

  Scénario: Création de données hors-ligne
    Étant donné que je suis en mode hors-ligne
    Quand je crée un rapport d'incident
    Alors les données sont sauvegardées localement
    Et elles sont marquées "En attente de sync"

  Scénario: Synchronisation automatique
    Étant donné que j'ai des données en attente
    Quand la connexion est rétablie
    Alors les données sont synchronisées automatiquement
    Et le statut passe à "Synchronisé"

  Scénario: Résolution de conflit
    Étant donné qu'un conflit de synchronisation est détecté
    Alors je vois une notification de conflit
    Et je peux choisir quelle version conserver

  Scénario: Synchronisation manuelle
    Quand je clique sur "Synchroniser maintenant"
    Alors toutes les données en attente sont envoyées
    Et un rapport de synchronisation s'affiche
