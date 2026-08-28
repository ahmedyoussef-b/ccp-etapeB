#language: fr
Fonctionnalité: Assistant IA et recherche multimédia
  En tant qu'utilisateur
  Je veux interagir avec l'assistant IA
  Afin d'obtenir de l'aide contextuelle

  Contexte:
    Étant donné je suis connecté en tant que "rondier"

  Scénario: Question à l'assistant IA
    Quand je clique sur "Assistant IA"
    Et je saisis "Comment signaler un incident?"
    Et je clique sur "Envoyer"
    Alors je reçois une réponse contextuelle
    Et la réponse contient des instructions pertinentes

  Scénario: Recherche d'images par IA
    Quand je clique sur "Recherche images"
    Et je saisis "Extincteur type ABC"
    Alors je vois les images correspondantes
    Et je peux sélectionner une image

  Scénario: Commande vocale
    Étant donné que je suis en mode exécution
    Quand je clique sur le microphone
    Et je dis "Étape suivante"
    Alors l'action est exécutée
    Et l'étape suivante s'affiche

  Scénario: Carte mentale interactive
    Étant donné une procédure avec mind map
    Quand je clique sur "Voir la carte mentale"
    Alors la mind map s'affiche
    Et je peux naviguer entre les nœuds
