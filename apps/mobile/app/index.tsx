import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/lib/theme';

export default function Index() {
  const { session, loading, onboardingCompleted, profile } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.greenDark} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  if (profile && !onboardingCompleted) {
    return <Redirect href="/(auth)/pending" />;
  }

  return <Redirect href="/(app)" />;
}
