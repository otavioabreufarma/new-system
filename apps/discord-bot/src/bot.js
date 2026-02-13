import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder
} from 'discord.js';

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const DISCORD_SHARED_TOKEN = process.env.DISCORD_SHARED_TOKEN;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const serverSelectEmbed = new EmbedBuilder()
  .setColor(0x00aeef)
  .setTitle('🛒 Loja VIP Rust')
  .setDescription('Selecione o servidor e siga o fluxo para vincular Steam e comprar VIP.');

function serverButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('server:solo').setLabel('Servidor SOLO').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('server:duo').setLabel('Servidor DUO').setStyle(ButtonStyle.Secondary)
  );
}

function steamButton(serverType, discordId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(`${BACKEND_URL}/auth/steam/start?discordId=${discordId}&serverType=${serverType}`)
      .setLabel('🔗 Vincular Steam')
  );
}

function purchaseButtons(serverType) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`buy:${serverType}:vip`).setLabel('🟢 Comprar VIP').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`buy:${serverType}:vip+`).setLabel('🔵 Comprar VIP+').setStyle(ButtonStyle.Primary)
  );
}

async function fetchLinkStatus(serverType, discordId) {
  const url = new URL('/discord/link-status', BACKEND_URL);
  url.searchParams.set('serverType', serverType);
  url.searchParams.set('discordId', discordId);

  const res = await fetch(url, {
    headers: { 'x-discord-token': DISCORD_SHARED_TOKEN }
  });

  if (!res.ok) {
    throw new Error(`Backend error ${res.status}`);
  }

  return res.json();
}

async function createCheckout(serverType, discordId, vipType) {
  const res = await fetch(new URL('/discord/create-checkout', BACKEND_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-discord-token': DISCORD_SHARED_TOKEN
    },
    body: JSON.stringify({ serverType, discordId, vipType })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Backend error ${res.status}`);
  }

  return data;
}

client.once(Events.ClientReady, async () => {
  const command = new SlashCommandBuilder().setName('vip').setDescription('Abrir painel da loja VIP');
  await client.application.commands.set([command.toJSON()]);
  // eslint-disable-next-line no-console
  console.log(`Bot pronto: ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'vip') {
      await interaction.reply({ embeds: [serverSelectEmbed], components: [serverButtons()], ephemeral: true });
      return;
    }

    if (!interaction.isButton()) {
      return;
    }

    if (interaction.customId.startsWith('server:')) {
      const [, serverType] = interaction.customId.split(':');
      const status = await fetchLinkStatus(serverType, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(`Servidor ${serverType.toUpperCase()}`)
        .setDescription(status.linked
          ? `Steam vinculada: **${status.steamId64}**\nEscolha seu plano VIP.`
          : 'Primeiro vincule sua conta Steam para continuar.')
        .addFields(
          { name: 'Status da Steam', value: status.linked ? '✅ Vinculada' : '❌ Não vinculada', inline: true },
          { name: 'Plano atual', value: status.vipType || 'Nenhum', inline: true }
        );

      await interaction.update({
        embeds: [embed],
        components: status.linked
          ? [purchaseButtons(serverType)]
          : [steamButton(serverType, interaction.user.id)]
      });
      return;
    }

    if (interaction.customId.startsWith('buy:')) {
      const [, serverType, vipType] = interaction.customId.split(':');
      const checkout = await createCheckout(serverType, interaction.user.id, vipType);

      const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('💳 Checkout criado com sucesso')
        .setDescription(`Plano: **${vipType.toUpperCase()}**\nPedido: **${checkout.orderNsu}**\n[Ir para pagamento](${checkout.checkoutUrl})`)
        .setFooter({ text: 'Após pagamento confirmado, o VIP é liberado automaticamente.' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    const message = 'Erro ao processar ação. Tente novamente em alguns segundos.';

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});

client.login(BOT_TOKEN);
