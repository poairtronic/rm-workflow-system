import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import './styles/tokens.css';
import './App.css';

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
