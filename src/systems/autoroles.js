const { getGuildData } = require('./database');

async function applyAutoRole(member, data) {
  const guildData = getGuildData(data, member.guild.id);
  const roleId = guildData.config.autoRoleId;

  if (!roleId) return;

  const role = await member.guild.roles.fetch(roleId).catch(() => null);
  if (!role) return;

  await member.roles.add(role, 'Auto cargo do bot').catch(() => null);
}

module.exports = {
  applyAutoRole
};
