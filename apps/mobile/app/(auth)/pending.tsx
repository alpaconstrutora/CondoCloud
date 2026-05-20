import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, radius, font } from '@/lib/theme';

export default function Pending() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Conta criada!</Text>
      <Text style={styles.sub}>
        Sua conta foi criada, mas você ainda não está vinculado a um condomínio.{'\n\n'}
        Aguarde o síndico enviar um link de convite ou acesse o link recebido por WhatsApp.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={signOut}>
        <Text style={styles.btnText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.xl, backgroundColor: colors.paper,
  },
  icon: { fontSize: 56, marginBottom: spacing.lg },
  title: { fontSize: 24, color: colors.ink, ...font.extrabold, marginBottom: spacing.sm, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'center', marginBottom: spacing.xl },
  btn: {
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.full,
    paddingVertical: 12, paddingHorizontal: 32, backgroundColor: colors.white,
  },
  btnText: { fontSize: 14, color: colors.muted, ...font.semibold },
});
