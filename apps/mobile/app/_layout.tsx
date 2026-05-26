import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import { AuthProvider } from '@/contexts/AuthContext';
import { configureAndroidChannel } from '@/lib/push-notifications';

SplashScreen.preventAutoHideAsync();

// Configura canal Android ao iniciar o app
configureAndroidChannel();

export default function RootLayout() {
  const notifListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);

  useEffect(() => {
    SplashScreen.hideAsync();

    // Listener: notificação recebida com app em foreground
    notifListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Push] Notificação recebida:', notification);
    });

    // Listener: usuário tocou na notificação
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[Push] Notificação tocada:', response);
      // TODO: navegar para a tela relevante com base no tipo de notificação
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
