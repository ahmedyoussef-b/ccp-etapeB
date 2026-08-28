#language: fr
Fonctionnalité: Exécution de procédure par le rondier
  En tant que rondier
  Je veux exécuter les procédures qui me sont assignées
  Afin de suivre les étapes conformément aux instructions

  Contexte:
    Étant donné je suis connecté en tant que "rondier"
    Et une procédure "Évacuation incendie" m'est assignée

  Scénario: Démarrage d'une procédure
    Quand je clique sur "Mes procédures"
    Et je sélectionne la procédure "Évacuation incendie"
    Et je clique sur "Commencer"
    Alors je vois la phase "Briefing"
    Et le briefing de la procédure s'affiche

  Scénario: Progression à travers les phases
    Étant donné que j'ai lu le briefing
    Quand je clique sur "Prérequis"
    Alors je vois la liste des prérequis
    Quand je coche tous les prérequis
    Et je clique sur "Commencer l'exécution"
    Alors je suis dans la phase "Exécution"

  Scénario: Exécution des étapes avec timer
    Étant donné que je suis en phase d'exécution
    Quand je complète l'étape "Alerter le chef de quart"
    Alors l'étape est marquée comme terminée
    Et le timer de l'étape s'arrête
    Quand je passe à l'étape suivante
    Alors le timer de l'étape suivante démarre

  Scénario: Signalement d'une anomalie
    Étant donné que je suis en cours d'exécution
    Quand je clique sur "Signaler une anomalie"
    Et je sélectionne la gravité "Critique"
    Et je saisis la description "Porte de sortie bloquée"
    Et je joins une photo
    Et je clique sur "Envoyer"
    Alors l'anomalie est enregistrée
    Et le superviseur est notifié

  Scénario: Abandon d'une procédure
    Étant donné que je suis en cours d'exécution
    Quand je clique sur "Abandonner"
    Et je saisis la raison "Situation sous contrôle"
    Et je confirme
    Alors la procédure est marquée comme "Abandonnée"
    Et le superviseur est notifié

  Scénario: Finalisation d'une procédure
    Étant donné que j'ai terminé toutes les étapes
    Quand je clique sur "Terminer"
    Alors la procédure est marquée comme "Complétée"
    Et un résumé s'affiche avec le temps total

  Scénario: Mode hors-ligne pendant l'exécution
    Étant donné que je suis en cours d'exécution
    Et je perds la connexion internet
    Alors je peux continuer l'exécution
    Et les données sont sauvegardées localement
    Quand la connexion est rétablie
    Alors les données sont synchronisées automatiquement
