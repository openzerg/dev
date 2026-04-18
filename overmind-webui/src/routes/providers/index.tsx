import { A } from "@solidjs/router";
import { Grid, Card, CardActionArea, CardContent, Typography, Box } from "@suid/material";
import Router from "@suid/icons-material/Router";
import Storage from "@suid/icons-material/Storage";
import BarChart from "@suid/icons-material/BarChart";
import { useI18n } from "~/i18n/context";

export default function ProvidersPage() {
  const { t } = useI18n();

  const cards = [
    { path: "/providers/configs", labelKey: "configs" as const, descKey: "configsDesc" as const, icon: Storage },
    { path: "/providers/proxies", labelKey: "proxies" as const, descKey: "proxiesDesc" as const, icon: Router },
    { path: "/providers/stats", labelKey: "stats" as const, descKey: "statsDesc" as const, icon: BarChart },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 3 }}>
        {t().nav.providers}
      </Typography>
      <Grid container spacing={3}>
        {cards.map((c) => (
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main' } }}>
              <CardActionArea component={A as any} href={c.path}>
                <CardContent sx={{ textAlign: "center", py: 4 }}>
                  <c.icon sx={{ fontSize: 48, mb: 1 }} color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {t().providers[c.labelKey]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t().providers[c.descKey]}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
