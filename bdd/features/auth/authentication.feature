#language: fr
Fonctionnalité: Authentification et gestion des rôles
  En tant qu'utilisateur de NexaFlow
  Je veux pouvoir me connecter avec mon rôle
  Afin d'accéder aux fonctionnalités appropriées

  Contexte:
    Soit un utilisateur enregistré dans le système

  Scénario: Connexion réussie en tant qu'admin
    Étant donné je suis sur la page de connexion
    Et je suis un utilisateur avec le rôle "admin"
    Quand je saisis l'email "admin@nexaflow.fr"
    Et je saisis le mot de passe "Admin123!"
    Et je clique sur le bouton "Se connecter"
    Alors je suis redirigé vers le tableau de bord
    Et je vois le message "Bienvenue"

  Scénario: Connexion avec identifiants invalides
    Étant donné je suis sur la page de connexion
    Quand je saisis l'email "invalide@nexaflow.fr"
    Et je saisis le mot de passe "MauvaisMotDePasse"
    Et je clique sur le bouton "Se connecter"
    Alors je vois le message d'erreur "Identifiants invalides"

  Scénario: Accès refusé sans authentification
    Étant donné je ne suis pas connecté
    Quand j'essaie d'accéder à "/procedures"
    Alors je suis redirigé vers la page de connexion

  Scénario: Déconnexion
    Étant donné je suis connecté en tant que "admin"
    Quand je clique sur le bouton "Déconnexion"
    Alors je suis redirigé vers la page de connexion

  Scénario: Redirection selon le rôle
    Étant donné je suis connecté en tant que "rondier"
    Alors je vois le module "Mes rondes"
    Et je ne vois pas le module "Administration"
