import { TProcedure } from "./services/validator.service";

export const mockProcedures: TProcedure[] = [
  {
    metadata: {
      title: "Démarrage du système de filtration CRF",
      code: "CRF-START-001",
      description:
        "Procédure de démarrage sécurisé du système de filtration CRF après maintenance ou arrêt prolongé.",
      category: "production",
      priority: "haute",
      estimatedTimeMinutes: 25,
      requiredRoles: ["technicien", "chef_de_quart"],
      globalSafetyInstructions: [
        "Porter les EPI obligatoires : casque, gants, lunettes de protection.",
        "Vérifier l'absence de pression dans les conduites avant toute intervention.",
        "Signaler toute anomalie au chef de quart immédiatement.",
      ],
    },
    steps: [
      {
        id: "step_1",
        title: "Vérification préalable de l'installation",
        subtitle: "Contrôles visuels et fonctionnels",
        instructions:
          "Inspecter l'ensemble des filtres, joints et raccords. Vérifier que les vannes d'isolement sont en position fermée. S'assurer que le poste de contrôle est opérationnel.",
        type: "inspection_visuelle",
        isMandatory: true,
        dependencies: [],
        mediaRequirements: [
          {
            type: "photo",
            mandatory: true,
            options: { geolocation: true, timestamp: true },
          },
        ],
        alarms: [
          {
            condition: "Fuite détectée",
            threshold: "Oui",
            type: "DANGER",
            message: "Arrêt immédiat. Signalement au responsable sécurité.",
          },
        ],
        attachments: [],
        order: 0,
        timerEnabled: true,
        timerSeconds: 300,
      },
      {
        id: "step_2",
        title: "Ouverture des vannes d'alimentation",
        subtitle: "Mise en eau progressive",
        instructions:
          "Ouvrir lentement la vanne d'alimentation principale. Surveiller les manomètres. Ouvrir la vanne de by-pass si la pression dépasse 3 bars.",
        type: "consigne_simple",
        isMandatory: true,
        dependencies: ["step_1"],
        mediaRequirements: [],
        alarms: [
          {
            condition: "Pression > 3 bar",
            threshold: "3 bar",
            type: "WARNING",
            message: "Ouvrir le by-pass immédiatement.",
          },
          {
            condition: "Pression > 5 bar",
            threshold: "5 bar",
            type: "DANGER",
            message: "Risque de rupture de conduite. Fermer l'alimentation.",
          },
        ],
        attachments: [],
        order: 1,
        timerEnabled: false,
        timerSeconds: 0,
      },
      {
        id: "step_3",
        title: "Lancement des pompes de circulation",
        subtitle: "Démarrage contrôlé",
        instructions:
          "Démarrer la pompe primaire en mode manuel. Vérifier l'absence de vibrations anormales. Surveiller le débitmètre pendant 60 secondes.",
        type: "validation_securite",
        isMandatory: true,
        dependencies: ["step_2"],
        mediaRequirements: [
          {
            type: "video",
            mandatory: false,
            options: { geolocation: false, timestamp: true },
          },
        ],
        alarms: [
          {
            condition: "Vibration > seuil",
            threshold: "N/A",
            type: "WARNING",
            message: "Arrêter la pompe et inspecter les paliers.",
          },
        ],
        attachments: ["fiche_pompe_primaire.pdf"],
        order: 2,
        timerEnabled: true,
        timerSeconds: 120,
      },
      {
        id: "step_4",
        title: "Enregistrement des paramètres",
        subtitle: "Saisie des valeurs de référence",
        instructions:
          "Noter la pression de sortie, le débit et la température dans le journal de quart. Prendre une photo de l'afficheur du poste de contrôle.",
        type: "saisie_donnees",
        isMandatory: false,
        dependencies: ["step_3"],
        mediaRequirements: [
          {
            type: "photo",
            mandatory: true,
            options: { geolocation: true, timestamp: true },
          },
          {
            type: "signature",
            mandatory: true,
            options: { geolocation: false, timestamp: true },
          },
        ],
        alarms: [],
        attachments: [],
        order: 3,
        timerEnabled: false,
        timerSeconds: 0,
      },
      {
        id: "step_5",
        title: "Clôture et transmission",
        subtitle: "Information de la relève",
        instructions:
          "Informer le chef de quart du bon démarrage. Transmettre le journal de quart signé. Ranger les outils et EPI.",
        type: "consigne_simple",
        isMandatory: true,
        dependencies: ["step_4"],
        mediaRequirements: [],
        alarms: [],
        attachments: [],
        order: 4,
        timerEnabled: false,
        timerSeconds: 0,
      },
    ],
  },
  {
    metadata: {
      title: "Calibration des capteurs de température",
      code: "CALIB-TEMP-002",
      description:
        "Procédure étalonnage annuel des capteurs de température des zones critiques.",
      category: "maintenance",
      priority: "moyenne",
      estimatedTimeMinutes: 40,
      requiredRoles: ["technicien"],
      globalSafetyInstructions: [
        "Utiliser uniquement des étalons certifiés.",
        "Ne pas intervenir sur un capteur en cours de mesure.",
      ],
    },
    steps: [
      {
        id: "step_a1",
        title: "Préparation des outils",
        instructions:
          "Rassembler le calibrateur, les câbles, le logiciel de configuration et les fiches d'étalonnage.",
        type: "consigne_simple",
        isMandatory: true,
        dependencies: [],
        mediaRequirements: [],
        alarms: [],
        attachments: [],
        order: 0,
        timerEnabled: false,
        timerSeconds: 0,
      },
      {
        id: "step_a2",
        title: "Mesure de référence",
        instructions:
          "Placer le calibrateur sur le capteur. Lancer la séquence de mesure et noter l'écart.",
        type: "mesure_numerique",
        isMandatory: true,
        dependencies: ["step_a1"],
        mediaRequirements: [
          {
            type: "photo",
            mandatory: true,
            options: { geolocation: false, timestamp: true },
          },
        ],
        alarms: [
          {
            condition: "Écart > 2°C",
            threshold: "2°C",
            type: "WARNING",
            message: "Capteur à remplacer ou réinitialiser.",
          },
        ],
        attachments: [],
        order: 1,
        timerEnabled: true,
        timerSeconds: 180,
      },
      {
        id: "step_a3",
        title: "Enregistrement du rapport",
        instructions:
          "Saisir les valeurs dans le logiciel et générer le certificat d'étalonnage.",
        type: "saisie_donnees",
        isMandatory: false,
        dependencies: ["step_a2"],
        mediaRequirements: [
          {
            type: "signature",
            mandatory: true,
            options: { geolocation: false, timestamp: true },
          },
        ],
        alarms: [],
        attachments: [],
        order: 2,
        timerEnabled: false,
        timerSeconds: 0,
      },
    ],
  },
  {
    metadata: {
      title: "Arrêt d'urgence ligne 3",
      code: "STOP-URG-003",
      description:
        "Procédure d'arrêt d'urgence en cas d'incident majeur sur la ligne de production 3.",
      category: "securite",
      priority: "critique",
      estimatedTimeMinutes: 10,
      requiredRoles: ["chef_de_quart", "rondier", "technicien"],
      globalSafetyInstructions: [
        "La sécurité des personnes prime sur la continuité de production.",
        "Déclencher l'alarme générale avant toute action.",
      ],
    },
    steps: [
      {
        id: "step_b1",
        title: "Déclenchement de l'alarme générale",
        instructions:
          "Appuyer sur le bouton d'alarme générale du poste de contrôle. Annoncer l'évacuation si nécessaire.",
        type: "validation_securite",
        isMandatory: true,
        dependencies: [],
        mediaRequirements: [],
        alarms: [
          {
            condition: "Bouton pressé",
            threshold: "N/A",
            type: "DANGER",
            message: "Évacuation immédiate de la zone.",
          },
        ],
        attachments: [],
        order: 0,
        timerEnabled: false,
        timerSeconds: 0,
      },
      {
        id: "step_b2",
        title: "Isolation électrique",
        instructions:
          "Couper l'alimentation électrique de la ligne 3 au panneau général. Consigner l'énergie.",
        type: "validation_securite",
        isMandatory: true,
        dependencies: ["step_b1"],
        mediaRequirements: [
          {
            type: "photo",
            mandatory: true,
            options: { geolocation: true, timestamp: true },
          },
        ],
        alarms: [],
        attachments: [],
        order: 1,
        timerEnabled: true,
        timerSeconds: 60,
      },
      {
        id: "step_b3",
        title: "Bilan et compte-rendu",
        instructions:
          "Faire l'appel du personnel. Remplir le rapport d'incident. Ne pas réarmer sans accord du responsable sécurité.",
        type: "saisie_donnees",
        isMandatory: true,
        dependencies: ["step_b2"],
        mediaRequirements: [
          {
            type: "signature",
            mandatory: true,
            options: { geolocation: false, timestamp: true },
          },
        ],
        alarms: [],
        attachments: [],
        order: 2,
        timerEnabled: false,
        timerSeconds: 0,
      },
    ],
  },
];
