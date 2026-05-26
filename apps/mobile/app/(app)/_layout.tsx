import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

function tabIcon(focused: boolean, name: IoniconsName, outlineName: IoniconsName) {
  return <Ionicons name={focused ? name : outlineName} size={22} color={focused ? colors.green : colors.muted} />;
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="tickets/index"
        options={{
          title: 'Chamados',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'construct', 'construct-outline'),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Avisos',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'chatbox', 'chatbox-outline'),
        }}
      />
      <Tabs.Screen
        name="charges"
        options={{
          title: 'Cobranças',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'receipt', 'receipt-outline'),
        }}
      />
      <Tabs.Screen
        name="assemblies"
        options={{
          title: 'Assembleias',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'people', 'people-outline'),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reservas',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'calendar', 'calendar-outline'),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Docs',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'folder', 'folder-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => tabIcon(focused, 'person', 'person-outline'),
        }}
      />

      {/* Ocultos da tab bar mas navegáveis */}
      <Tabs.Screen name="tickets/[id]" options={{ href: null }} />
    </Tabs>
  );
}
