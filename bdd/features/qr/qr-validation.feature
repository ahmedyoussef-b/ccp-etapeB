#language: fr
Fonctionnalité: Validation par QR Code
  En tant que rondier
  Je veux scanner des QR codes aux points de contrôle
  Afin de valider ma présence et recevoir des instructions

  Contexte:
    Étant donné je suis connecté en tant que "rondier"
    Et des QR codes sont déployés sur le site

  Scénario: Scan d'un QR code valide
    Quand je scanne le QR code "ENTREE_PRINCIPALE"
    Alors le point de contrôle est validé
    Et l'heure de passage est enregistrée

  Scénario: Scan avec scoring
    Quand je scanne un QR code
    Alors je vois le score de conformité du point
    Et les instructions associées s'affichent

  Scénario: QR code invalide ou expiré
    Quand je scanne un QR code invalide
    Alors je vois le message "QR code non reconnu"
    Et l'incident est signalé

  Scénario: Validation d'accès restreint
    Étant donné une zone à accès restreint
    Quand je scanne le QR code de la zone
    Et que j'ai les droits d'accès
    Alors l'accès est autorisé
    Et l'entrée est journalisée

  Scénario: Tentative d'accès non autorisé
    Étant donné une zone à accès restreint
    Quand je scanne le QR code de la zone
    Et que je n'ai pas les droits d'accès
    Alors l'accès est refusé
    Et une alerte est envoyée au superviseur
