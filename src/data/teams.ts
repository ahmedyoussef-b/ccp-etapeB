export const rolesConfig: Record<string, { label: string; color: string }> = {
  chef_de_quart: { label: "Chef de quart", color: "bg-amber-500" },
  chef_de_bloc_tg1: { label: "Chef de bloc TG1", color: "bg-blue-500" },
  chef_de_bloc_tg2: { label: "Chef de bloc TG2", color: "bg-indigo-500" },
  rondier_tv: { label: "Rondier TV", color: "bg-emerald-500" },
  rondier_post_gaz: { label: "Rondier Post Gaz & Auxiliaires", color: "bg-orange-500" },
  rondier_tg1: { label: "Rondier TG1", color: "bg-cyan-500" },
  rondier_tg2: { label: "Rondier TG2", color: "bg-violet-500" },
};

export const teams = [
  {
    id: 1,
    name: "Équipe A",
    description: "Équipe de quart A — secteur production",
    color: "bg-blue-500",
    members: 7,
    members_list: [
      { id: 1, name: "Chef Quart A", email: "cq-a@centrale.com", role: "chef_de_quart", status: "active", avatar: "CQA" },
      { id: 2, name: "Chef Bloc TG1 A", email: "cb-tg1-a@centrale.com", role: "chef_de_bloc_tg1", status: "active", avatar: "CBA" },
      { id: 3, name: "Chef Bloc TG2 A", email: "cb-tg2-a@centrale.com", role: "chef_de_bloc_tg2", status: "active", avatar: "CBA2" },
      { id: 4, name: "Rondier TV A", email: "r-tv-a@centrale.com", role: "rondier_tv", status: "active", avatar: "RTA" },
      { id: 5, name: "Rondier Post Gaz A", email: "r-pg-a@centrale.com", role: "rondier_post_gaz", status: "active", avatar: "RPA" },
      { id: 6, name: "Rondier TG1 A", email: "r-tg1-a@centrale.com", role: "rondier_tg1", status: "active", avatar: "R1A" },
      { id: 7, name: "Rondier TG2 A", email: "r-tg2-a@centrale.com", role: "rondier_tg2", status: "active", avatar: "R2A" },
    ],
  },
  {
    id: 2,
    name: "Équipe B",
    description: "Équipe de quart B — secteur production",
    color: "bg-purple-500",
    members: 7,
    members_list: [
      { id: 8, name: "Chef Quart B", email: "cq-b@centrale.com", role: "chef_de_quart", status: "active", avatar: "CQB" },
      { id: 9, name: "Chef Bloc TG1 B", email: "cb-tg1-b@centrale.com", role: "chef_de_bloc_tg1", status: "active", avatar: "CBB1" },
      { id: 10, name: "Chef Bloc TG2 B", email: "cb-tg2-b@centrale.com", role: "chef_de_bloc_tg2", status: "active", avatar: "CBB2" },
      { id: 11, name: "Rondier TV B", email: "r-tv-b@centrale.com", role: "rondier_tv", status: "active", avatar: "RTB" },
      { id: 12, name: "Rondier Post Gaz B", email: "r-pg-b@centrale.com", role: "rondier_post_gaz", status: "active", avatar: "RPB" },
      { id: 13, name: "Rondier TG1 B", email: "r-tg1-b@centrale.com", role: "rondier_tg1", status: "active", avatar: "R1B" },
      { id: 14, name: "Rondier TG2 B", email: "r-tg2-b@centrale.com", role: "rondier_tg2", status: "active", avatar: "R2B" },
    ],
  },
  {
    id: 3,
    name: "Équipe C",
    description: "Équipe de quart C — secteur production",
    color: "bg-emerald-500",
    members: 7,
    members_list: [
      { id: 15, name: "Chef Quart C", email: "cq-c@centrale.com", role: "chef_de_quart", status: "active", avatar: "CQC" },
      { id: 16, name: "Chef Bloc TG1 C", email: "cb-tg1-c@centrale.com", role: "chef_de_bloc_tg1", status: "active", avatar: "CBC1" },
      { id: 17, name: "Chef Bloc TG2 C", email: "cb-tg2-c@centrale.com", role: "chef_de_bloc_tg2", status: "active", avatar: "CBC2" },
      { id: 18, name: "Rondier TV C", email: "r-tv-c@centrale.com", role: "rondier_tv", status: "active", avatar: "RTC" },
      { id: 19, name: "Rondier Post Gaz C", email: "r-pg-c@centrale.com", role: "rondier_post_gaz", status: "active", avatar: "RPC" },
      { id: 20, name: "Rondier TG1 C", email: "r-tg1-c@centrale.com", role: "rondier_tg1", status: "away", avatar: "R1C" },
      { id: 21, name: "Rondier TG2 C", email: "r-tg2-c@centrale.com", role: "rondier_tg2", status: "active", avatar: "R2C" },
    ],
  },
  {
    id: 4,
    name: "Équipe D",
    description: "Équipe de quart D — secteur production",
    color: "bg-amber-500",
    members: 7,
    members_list: [
      { id: 22, name: "Chef Quart D", email: "cq-d@centrale.com", role: "chef_de_quart", status: "active", avatar: "CQD" },
      { id: 23, name: "Chef Bloc TG1 D", email: "cb-tg1-d@centrale.com", role: "chef_de_bloc_tg1", status: "active", avatar: "CBD1" },
      { id: 24, name: "Chef Bloc TG2 D", email: "cb-tg2-d@centrale.com", role: "chef_de_bloc_tg2", status: "active", avatar: "CBD2" },
      { id: 25, name: "Rondier TV D", email: "r-tv-d@centrale.com", role: "rondier_tv", status: "active", avatar: "RTD" },
      { id: 26, name: "Rondier Post Gaz D", email: "r-pg-d@centrale.com", role: "rondier_post_gaz", status: "active", avatar: "RPD" },
      { id: 27, name: "Rondier TG1 D", email: "r-tg1-d@centrale.com", role: "rondier_tg1", status: "away", avatar: "R1D" },
      { id: 28, name: "Rondier TG2 D", email: "r-tg2-d@centrale.com", role: "rondier_tg2", status: "active", avatar: "R2D" },
    ],
  },
];

export type Team = typeof teams[0];
export type Member = Team["members_list"][0];
