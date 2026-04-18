import { createResource, createSignal, For, Show } from "solid-js";
import {
  Box,
  Card,
  CardContent,
  Grid,
  IconButton,
  Typography,
  CircularProgress,
} from "@suid/material";
import ArrowBack from "@suid/icons-material/ArrowBack";
import { useNavigate } from "@solidjs/router";
import { getAiProxy } from "~/lib/clients";
import { useI18n } from "~/i18n/context";

export default function ProviderStatsPage() {
  const aiProxy = getAiProxy();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [stats] = createResource(async () => {
    const r = await aiProxy.getTokenStats({ proxyId: "", fromTs: 0n, toTs: 0n });
    if (r.isErr()) return { totalInputTokens: 0n, totalOutputTokens: 0n, totalTokens: 0n, requestCount: 0n };
    return r.value;
  });

  const s = () => stats() as any;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate("/providers")} size="small">
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {t().providers.stats}
        </Typography>
      </Box>

      <Show when={!stats.loading} fallback={<CircularProgress />}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline" color="text.secondary">{t().providers.totalTokens}</Typography>
                <Typography variant="h4" color="primary">
                  {Number(s()?.totalTokens ?? 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline" color="text.secondary">{t().providers.inputTokens}</Typography>
                <Typography variant="h4" color="success.main">
                  {Number(s()?.totalInputTokens ?? 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline" color="text.secondary">{t().providers.outputTokens}</Typography>
                <Typography variant="h4" color="warning.main">
                  {Number(s()?.totalOutputTokens ?? 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline" color="text.secondary">{t().providers.totalRequests}</Typography>
                <Typography variant="h4" color="info.main">
                  {Number(s()?.requestCount ?? 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Show>
    </Box>
  );
}
