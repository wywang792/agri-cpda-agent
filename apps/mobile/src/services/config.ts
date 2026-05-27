import Constants from 'expo-constants';

function getExpoHost(): string | undefined {
  const constants = Constants as typeof Constants & {
    manifest?: { debuggerHost?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
  };

  const hostUri =
    Constants.expoConfig?.hostUri ||
    constants.manifest2?.extra?.expoGo?.debuggerHost ||
    constants.manifest?.debuggerHost;

  return hostUri?.split(':')[0];
}

function getDefaultApiBase(): string {
  const host = getExpoHost();
  return host ? `http://${host}:3000` : 'http://10.0.2.2:3000';
}

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || getDefaultApiBase();
