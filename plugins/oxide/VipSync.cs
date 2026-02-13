using System;
using Newtonsoft.Json;
using Oxide.Core.Libraries.Covalence;

namespace Oxide.Plugins
{
    [Info("VipSync", "YourTeam", "1.0.0")]
    [Description("Sincroniza VIP/vip+ do backend para o servidor Rust")]
    public class VipSync : CovalencePlugin
    {
        private Configuration _config;

        private class Configuration
        {
            [JsonProperty("Backend URL")]
            public string BackendUrl = "http://127.0.0.1:3000";

            [JsonProperty("Server Type (solo|duo)")]
            public string ServerType = "solo";

            [JsonProperty("Plugin Shared Token")]
            public string PluginToken = "change-me";

            [JsonProperty("Check Interval Seconds")]
            public int CheckIntervalSeconds = 300;
        }

        private class VipStatusResponse
        {
            [JsonProperty("active")]
            public bool Active;

            [JsonProperty("vipType")]
            public string VipType;

            [JsonProperty("expirationDate")]
            public string ExpirationDate;
        }

        protected override void LoadDefaultConfig() => _config = new Configuration();

        protected override void LoadConfig()
        {
            base.LoadConfig();
            _config = Config.ReadObject<Configuration>();
            if (_config == null)
            {
                PrintWarning("Config inválida, recriando.");
                LoadDefaultConfig();
            }
            SaveConfig();
        }

        protected override void SaveConfig() => Config.WriteObject(_config, true);

        private void Init()
        {
            permission.RegisterPermission("vipsync.admin", this);
            timer.Every(_config.CheckIntervalSeconds, SyncAllOnlinePlayers);
        }

        private void OnUserConnected(IPlayer player)
        {
            CheckAndSyncPlayer(player);
        }

        [Command("vipsync.check")]
        private void CmdVipSync(IPlayer player, string command, string[] args)
        {
            if (player != null && !player.HasPermission("vipsync.admin"))
            {
                player.Reply("Sem permissão.");
                return;
            }

            SyncAllOnlinePlayers();
            player?.Reply("Sincronização disparada.");
        }

        private void SyncAllOnlinePlayers()
        {
            foreach (var onlinePlayer in players.Connected)
            {
                CheckAndSyncPlayer(onlinePlayer);
            }
        }

        private void CheckAndSyncPlayer(IPlayer player)
        {
            var steamId64 = player.Id;
            var url = $"{_config.BackendUrl}/plugin/vip-status?serverType={_config.ServerType}&steamId64={steamId64}";

            webrequest.Enqueue(url, null, (statusCode, body) =>
            {
                if (statusCode != 200 || string.IsNullOrEmpty(body))
                {
                    Puts($"Falha ao consultar backend para {steamId64}. Status={statusCode}");
                    return;
                }

                var response = JsonConvert.DeserializeObject<VipStatusResponse>(body);
                if (response == null)
                {
                    Puts($"Resposta inválida para {steamId64}");
                    return;
                }

                ApplyVipState(player, response);
            }, this, Core.Libraries.RequestMethod.GET, new System.Collections.Generic.Dictionary<string, string>
            {
                ["Authorization"] = $"Bearer {_config.PluginToken}"
            });
        }

        private void ApplyVipState(IPlayer player, VipStatusResponse response)
        {
            var userId = player.Id;

            // Sempre garantir que apenas vip/vip+ existam.
            permission.RemoveUserGroup(userId, "vip");
            permission.RemoveUserGroup(userId, "vip+");

            if (!response.Active || string.IsNullOrEmpty(response.VipType))
            {
                player.Message("Seu VIP expirou ou não está ativo.");
                return;
            }

            if (response.VipType != "vip" && response.VipType != "vip+")
            {
                Puts($"Tipo VIP inválido recebido: {response.VipType} para {userId}");
                return;
            }

            if (!permission.GroupExists(response.VipType))
            {
                permission.CreateGroup(response.VipType, response.VipType, 0);
            }

            permission.AddUserGroup(userId, response.VipType);
            player.Message($"VIP sincronizado com sucesso: {response.VipType}");
        }
    }
}
