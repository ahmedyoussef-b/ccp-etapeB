import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("[seed] Démarrage du seed...");

  console.log("[seed] Nettoyage des tables existantes...");
  await prisma.auditLog.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.member.deleteMany();
  await prisma.team.deleteMany();
  await prisma.procedure.deleteMany();
  console.log("[seed] Tables nettoyées.");

  console.log("[seed] Création des équipes...");
  const teamA = await prisma.team.create({
    data: { name: "Équipe A", description: "Équipe de quart A — secteur production", color: "bg-blue-500", members: 7 },
  });
  console.log("[seed] Équipe A créée.");

  const teamB = await prisma.team.create({
    data: { name: "Équipe B", description: "Équipe de quart B — secteur production", color: "bg-purple-500", members: 7 },
  });
  console.log("[seed] Équipe B créée.");

  const teamC = await prisma.team.create({
    data: { name: "Équipe C", description: "Équipe de quart C — secteur production", color: "bg-emerald-500", members: 7 },
  });
  console.log("[seed] Équipe C créée.");

  const teamD = await prisma.team.create({
    data: { name: "Équipe D", description: "Équipe de quart D — secteur production", color: "bg-amber-500", members: 7 },
  });
  console.log("[seed] Équipe D créée.");

  console.log("[seed] Création des membres...");
  await prisma.member.createMany({
    data: [
      { name: "Chef Quart A", email: "cq-a@centrale.com", role: "chef_de_quart", status: "active", avatar: "CQA" },
      { name: "Chef Bloc TG1 A", email: "cb-tg1-a@centrale.com", role: "chef_de_bloc_tg1", status: "active", avatar: "CBA" },
      { name: "Chef Bloc TG2 A", email: "cb-tg2-a@centrale.com", role: "chef_de_bloc_tg2", status: "active", avatar: "CBA2" },
      { name: "Rondier TV A", email: "r-tv-a@centrale.com", role: "rondier_tv", status: "active", avatar: "RTA" },
      { name: "Rondier Post Gaz A", email: "r-pg-a@centrale.com", role: "rondier_post_gaz", status: "active", avatar: "RPA" },
      { name: "Rondier TG1 A", email: "r-tg1-a@centrale.com", role: "rondier_tg1", status: "active", avatar: "R1A" },
      { name: "Rondier TG2 A", email: "r-tg2-a@centrale.com", role: "rondier_tg2", status: "active", avatar: "R2A" },
      { name: "Chef Quart B", email: "cq-b@centrale.com", role: "chef_de_quart", status: "active", avatar: "CQB" },
      { name: "Chef Bloc TG1 B", email: "cb-tg1-b@centrale.com", role: "chef_de_bloc_tg1", status: "active", avatar: "CBB1" },
      { name: "Chef Bloc TG2 B", email: "cb-tg2-b@centrale.com", role: "chef_de_bloc_tg2", status: "active", avatar: "CBB2" },
      { name: "Rondier TV B", email: "r-tv-b@centrale.com", role: "rondier_tv", status: "active", avatar: "RTB" },
      { name: "Rondier Post Gaz B", email: "r-pg-b@centrale.com", role: "rondier_post_gaz", status: "active", avatar: "RPB" },
      { name: "Rondier TG1 B", email: "r-tg1-b@centrale.com", role: "rondier_tg1", status: "active", avatar: "R1B" },
      { name: "Rondier TG2 B", email: "r-tg2-b@centrale.com", role: "rondier_tg2", status: "active", avatar: "R2B" },
      { name: "Chef Quart C", email: "cq-c@centrale.com", role: "chef_de_quart", status: "active", avatar: "CQC" },
      { name: "Chef Bloc TG1 C", email: "cb-tg1-c@centrale.com", role: "chef_de_bloc_tg1", status: "active", avatar: "CBC1" },
      { name: "Chef Bloc TG2 C", email: "cb-tg2-c@centrale.com", role: "chef_de_bloc_tg2", status: "active", avatar: "CBC2" },
      { name: "Rondier TV C", email: "r-tv-c@centrale.com", role: "rondier_tv", status: "active", avatar: "RTC" },
      { name: "Rondier Post Gaz C", email: "r-pg-c@centrale.com", role: "rondier_post_gaz", status: "active", avatar: "RPC" },
      { name: "Rondier TG1 C", email: "r-tg1-c@centrale.com", role: "rondier_tg1", status: "away", avatar: "R1C" },
      { name: "Rondier TG2 C", email: "r-tg2-c@centrale.com", role: "rondier_tg2", status: "active", avatar: "R2C" },
      { name: "Chef Quart D", email: "cq-d@centrale.com", role: "chef_de_quart", status: "active", avatar: "CQD" },
      { name: "Chef Bloc TG1 D", email: "cb-tg1-d@centrale.com", role: "chef_de_bloc_tg1", status: "active", avatar: "CBD1" },
      { name: "Chef Bloc TG2 D", email: "cb-tg2-d@centrale.com", role: "chef_de_bloc_tg2", status: "active", avatar: "CBD2" },
      { name: "Rondier TV D", email: "r-tv-d@centrale.com", role: "rondier_tv", status: "active", avatar: "RTD" },
      { name: "Rondier Post Gaz D", email: "r-pg-d@centrale.com", role: "rondier_post_gaz", status: "active", avatar: "RPD" },
      { name: "Rondier TG1 D", email: "r-tg1-d@centrale.com", role: "rondier_tg1", status: "away", avatar: "R1D" },
      { name: "Rondier TG2 D", email: "r-tg2-d@centrale.com", role: "rondier_tg2", status: "active", avatar: "R2D" },
    ],
    skipDuplicates: true,
  });
  console.log("[seed] Membres créés.");

  const createdMembers = await prisma.member.findMany();
  console.log(`[seed] ${createdMembers.length} membres récupérés.`);

  const teamAMembers = createdMembers.filter((m: { email: string }) => m.email.startsWith("cq-a") || m.email.startsWith("cb-tg1-a") || m.email.startsWith("cb-tg2-a") || m.email.startsWith("r-tv-a") || m.email.startsWith("r-pg-a") || m.email.startsWith("r-tg1-a") || m.email.startsWith("r-tg2-a"));
  const teamBMembers = createdMembers.filter((m: { email: string }) => m.email.startsWith("cq-b") || m.email.startsWith("cb-tg1-b") || m.email.startsWith("cb-tg2-b") || m.email.startsWith("r-tv-b") || m.email.startsWith("r-pg-b") || m.email.startsWith("r-tg1-b") || m.email.startsWith("r-tg2-b"));
  const teamCMembers = createdMembers.filter((m: { email: string }) => m.email.startsWith("cq-c") || m.email.startsWith("cb-tg1-c") || m.email.startsWith("cb-tg2-c") || m.email.startsWith("r-tv-c") || m.email.startsWith("r-pg-c") || m.email.startsWith("r-tg1-c") || m.email.startsWith("r-tg2-c"));
  const teamDMembers = createdMembers.filter((m: { email: string }) => m.email.startsWith("cq-d") || m.email.startsWith("cb-tg1-d") || m.email.startsWith("cb-tg2-d") || m.email.startsWith("r-tv-d") || m.email.startsWith("r-pg-d") || m.email.startsWith("r-tg1-d") || m.email.startsWith("r-tg2-d"));

  console.log("[seed] Création des TeamMember...");
  for (const member of teamAMembers) {
    await prisma.teamMember.create({ data: { teamId: teamA.id, memberId: member.id } });
  }
  console.log("[seed] TeamMember Équipe A créés.");

  for (const member of teamBMembers) {
    await prisma.teamMember.create({ data: { teamId: teamB.id, memberId: member.id } });
  }
  console.log("[seed] TeamMember Équipe B créés.");

  for (const member of teamCMembers) {
    await prisma.teamMember.create({ data: { teamId: teamC.id, memberId: member.id } });
  }
  console.log("[seed] TeamMember Équipe C créés.");

  for (const member of teamDMembers) {
    await prisma.teamMember.create({ data: { teamId: teamD.id, memberId: member.id } });
  }
  console.log("[seed] TeamMember Équipe D créés.");

  console.log("[seed] Création des procédures...");
  await prisma.procedure.createMany({
    data: [
      { title: "Procédure de démarrage turbine", slug: "demarrage-turbine", content: "Étapes de démarrage sécurisé de la turbine TG1.", category: "Turbine", isPublished: true },
      { title: "Procédure d'arrêt d'urgence", slug: "arret-urgence", content: "Protocole d'arrêt d'urgence du bloc production.", category: "Sécurité", isPublished: true },
      { title: "Consignes rondier TV", slug: "consignes-rondier-tv", content: "Parcours et points de contrôle pour le rondier TV.", category: "Rondes", isPublished: true },
    ],
    skipDuplicates: true,
  });
  console.log("[seed] Procédures créées.");

  console.log("[seed] Import de l'arborescence depuis .data...");
  await import("../scripts/seed-tree-from-data-dir");

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
