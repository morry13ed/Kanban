import Sidebar from './components/Sidebar';
import Board from './components/Board';
import AuthScreen from './components/AuthScreen';
import { useAuth } from './context/AuthContext';
import './App.css';

function App() {
  const { enabled, ready, user } = useAuth();

  // Cloud configured but nobody signed in: the gate. Without Supabase
  // configured the app stays a local, single-browser tool as before.
  if (enabled && !ready) return null;
  if (enabled && !user) return <AuthScreen />;

  return (
    <div className="app">
      <Sidebar />
      <Board />
    </div>
  );
}

export default App;
