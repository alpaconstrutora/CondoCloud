import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

// Configuração global: como as notificações são exibidas quando o app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Solicita permissão de notificação e registra o token Expo na API.
 * Deve ser chamada quando o usuário fizer login.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Simuladores e web não suportam push nativo
  if (!Constants.isDevice) {
    console.log('[Push] Push notifications só funcionam em dispositivos físicos.');
    return null;
  }

  // Verifica se já temos permissão
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permissão de notificação negada pelo usuário.');
    return null;
  }

  // Obtém o token Expo Push
  const projectId =
    Constants.expoConfig?.extra?.['eas']?.['projectId'] ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('[Push] EAS projectId não configurado — pulando registro de push token.');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // Envia o token para a API
    await api.patch('/auth/me', { push_token: token });
    console.log('[Push] Token registrado com sucesso:', token);
    return token;
  } catch (err) {
    console.error('[Push] Erro ao registrar token de push:', err);
    return null;
  }
}

/**
 * Configura canal de notificação para Android (obrigatório no Android 8+).
 */
export function configureAndroidChannel() {
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'CondoCloud',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16A869',
    });
  }
}
