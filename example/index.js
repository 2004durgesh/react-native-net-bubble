import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { configureAutoSymbolication } from 'react-native-net-bubble';

// Enable offline symbolication for non-debug builds so the Initiator tab
// shows the exact file:line that fired each request even without Metro.
// In __DEV__ this is a no-op — Metro's /symbolicate path takes over.
configureAutoSymbolication();

AppRegistry.registerComponent(appName, () => App);

if (typeof document !== 'undefined') {
  AppRegistry.runApplication(appName, {
    rootTag: document.getElementById('root'),
  });
}
