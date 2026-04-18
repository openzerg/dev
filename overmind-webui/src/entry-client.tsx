import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import { lazy } from 'solid-js';
import './app.css';
import { AppThemeProvider } from './lib/theme';
import { I18nProvider } from './i18n/context';
import { OvermindProvider } from './lib/store';
import Layout from './components/Layout';

const Connect = lazy(() => import('./routes/connect'));
const Dashboard = lazy(() => import('./routes/index'));
const Sessions = lazy(() => import('./routes/sessions/index'));
const SessionNew = lazy(() => import('./routes/sessions/new'));
const SessionDetail = lazy(() => import('./routes/sessions/[id]'));
const Roles = lazy(() => import('./routes/roles/index'));
const RoleDetail = lazy(() => import('./routes/roles/[id]'));
const Skills = lazy(() => import('./routes/skills/index'));
const Instances = lazy(() => import('./routes/instances'));
const Workspaces = lazy(() => import('./routes/workspaces'));
const Providers = lazy(() => import('./routes/providers/index'));
const Proxies = lazy(() => import('./routes/providers/proxies'));
const ProviderConfigs = lazy(() => import('./routes/providers/configs'));
const ProviderStats = lazy(() => import('./routes/providers/stats'));
const Settings = lazy(() => import('./routes/settings'));

render(() => (
  <AppThemeProvider>
    <I18nProvider>
      <OvermindProvider>
        <Router root={Layout}>
          <Route path="/connect" component={Connect} />
          <Route path="/" component={Dashboard} />
          <Route path="/sessions" component={Sessions} />
          <Route path="/sessions/new" component={SessionNew} />
          <Route path="/sessions/:id" component={SessionDetail} />
          <Route path="/roles" component={Roles} />
          <Route path="/roles/:id" component={RoleDetail} />
          <Route path="/skills" component={Skills} />
          <Route path="/instances" component={Instances} />
          <Route path="/workspaces" component={Workspaces} />
          <Route path="/providers" component={Providers} />
          <Route path="/providers/proxies" component={Proxies} />
          <Route path="/providers/configs" component={ProviderConfigs} />
          <Route path="/providers/stats" component={ProviderStats} />
          <Route path="/settings" component={Settings} />
        </Router>
      </OvermindProvider>
    </I18nProvider>
  </AppThemeProvider>
), document.getElementById('app')!);
