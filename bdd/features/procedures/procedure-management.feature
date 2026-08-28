#language: fr
Fonctionnalité: Gestion des procédures
  En tant que chef de quart ou superviseur
  Je veux créer, modifier et valider des procédures
  Afin de standardiser les opérations de sécurité

  Contexte:
    Étant donné je suis connecté en tant que "chef_de_quart"

  Scénario: Création d'une nouvelle procédure
    Quand je clique sur "Nouvelle procédure"
    Et je saisis le titre "Procédure évacuation incendie"
    Et je saisis la description "Procédure d'évacuation en cas d'incendie"
    Et j'ajoute une étape avec le titre "Alerter le chef de quart"
    Et j'ajoute une étape avec le titre "Évacuer le bâtiment"
    Et je clique sur "Enregistrer le brouillon"
    Alors je vois le message "Procédure créée avec succès"
    Et la procédure apparaît dans la liste avec le statut "Brouillon"

  Scénario: Ajout d'étapes avec glisser-déposer
    Étant donné une procédure existante en brouillon
    Quand j'ajoute une étape "Vérifier les sorties"
    Et je déplace l'étape à la position 2
    Et je clique sur "Enregistrer"
    Alors l'ordre des étapes est mis à jour

  Scénario: Soumission pour validation
    Étant donné une procédure en brouillon
    Quand je clique sur "Soumettre pour validation"
    Alors le statut de la procédure devient "Soumise"
    Et le superviseur reçoit une notification

  Scénario: Validation par le superviseur
    Étant donné je suis connecté en tant que "superviseur"
    Et une procédure est en attente de validation
    Quand j'ouvre la procédure
    Et je clique sur "Approuver"
    Alors le statut de la procédure devient "Approuvée"

  Scénario: Rejet avec commentaire
    Étant donné je suis connecté en tant que "superviseur"
    Et une procédure est en attente de validation
    Quand j'ouvre la procédure
    Et je clique sur "Rejeter"
    Et je saisis le commentaire "Étapes incomplètes"
    Alors le statut de la procédure devient "Rejetée"
    Et le chef de quart reçoit la notification de rejet

  Scénario: Export JSON d'une procédure
    Étant donné une procédure approuvée
    Quand je clique sur "Exporter"
    Alors un fichier JSON est téléchargé
    Et le fichier contient toutes les étapes de la procédure

  Scénario: Import d'une procédure depuis JSON
    Quand je clique sur "Importer"
    Et je sélectionne un fichier JSON valide
    Alors la procédure est créée avec succès

  Scénario: Création d'une nouvelle version
    Étant donné une procédure approuvée
    Quand je clique sur "Nouvelle version"
    Et je modifie le titre
    Et je soumets pour validation
    Alors une nouvelle version est créée
    Et l'ancienne version reste accessible
