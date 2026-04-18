import { Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Divider,
} from "@suid/material";
import Logout from "@suid/icons-material/Logout";
import { useStore } from "~/lib/store";
import { useI18n } from "~/i18n/context";

export default function SettingsPage() {
  const navigate = useNavigate();
  const app = useStore();
  const { t } = useI18n();

  function handleDisconnect() {
    app.disconnect();
    navigate("/connect");
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 3 }}>
        {t().nav.settings}
      </Typography>

      <Card variant="outlined" sx={{ maxWidth: 600 }}>
        <CardContent>
          <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>Connection</Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Backend URL</Typography>
            <Typography variant="body1" color="text.primary">
              {app.backend()?.url || "Not connected"}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Show when={app.connected()} fallback={
              <Typography variant="body1" color="error.main">Disconnected</Typography>
            }>
              <Typography variant="body1" color="success.main">Connected</Typography>
            </Show>
          </Box>

          <Show when={app.backend()}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Label</Typography>
              <Typography variant="body1" color="text.primary">
                {app.backend()!.label}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">Token</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: "monospace" }}>
                {app.backend()!.token.substring(0, 12)}...
              </Typography>
            </Box>
          </Show>

          <Divider sx={{ borderColor: 'divider', my: 2 }} />

          <Button
            variant="outlined"
            color="error"
            startIcon={<Logout />}
            onClick={handleDisconnect}
            disabled={!app.connected()}
          >
            {t().actions.disconnect}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
