#language: fr
Fonctionnalité: Gestion des équipes et utilisateurs
  En tant qu'admin
  Je veux gérer les équipes et les utilisateurs
  Afin d'organiser le personnel de sécurité

  Contexte:
    Étant donné je suis connecté en tant que "admin"

  Scénario: Création d'une équipe
    Quand je clique sur "Équipes"
    Et je clique sur "Nouvelle équipe"
    Et je saisis le nom "Équipe Alpha"
    Et je sélectionne le chef de bloc "Jean Dupont"
    Et je clique sur "Créer"
    Alors l'équipe est créée avec succès
    Et elle apparaît dans la liste

  Scénario: Ajout d'un membre à une équipe
    Étant donné une équipe existante
    Quand je clique sur "Ajouter un membre"
    Et je sélectionne l'utilisateur "Martin Paul"
    Et je confirme
    Alors le membre est ajouté à l'équipe

  Scénario: Modification du rôle d'un utilisateur
    Étant donné un utilisateur existant
    Quand je clique sur "Modifier"
    Et je change le rôle de "rondier" à "chef_de_quart"
    Et je sauvegarde
    Alors le rôle est mis à jour
    Et les permissions sont ajustées

  Scénario: Désactivation d'un compte
    Étant donné un utilisateur actif
    Quand je clique sur "Désactiver"
    Et je confirme
    Alors le compte est désactivé
    Et l'utilisateur ne peut plus se connecter

  Scénario: Consultation de la hiérarchie
    Quand je clique sur "Hiérarchie"
    Alors je vois l'organigramme de l'équipe
    Et les relations superviseur-subordonnés sont affichées
