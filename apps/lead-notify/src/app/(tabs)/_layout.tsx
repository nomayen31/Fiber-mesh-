import { Tabs } from "expo-router";
import {
  LayoutDashboard,
  Mail,
  Settings,
  ShoppingCart,
} from "lucide-react-native";

import { colors, typography } from "@/theme";

/**
 * The same three destinations as the website's admin navigation (overview,
 * orders, customer messages) plus a mobile-only Settings tab for the device
 * registration state, which has no web equivalent.
 *
 * Navigation shape is the one deliberate divergence from the web: a desktop
 * sidebar becomes a bottom tab bar. Colours, typography, spacing and badges are
 * unchanged.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.slate[900] },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: typography.weight.bold as "700",
          fontSize: typography.size.base,
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.slate[400],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.slate[200],
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.semibold as "600",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "ওভারভিউ",
          headerTitle: "ওভারভিউ ও অ্যানালিটিক্স",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "অর্ডার",
          headerTitle: "অর্ডার ম্যানেজমেন্ট",
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart size={size} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "মেসেজ",
          headerTitle: "গ্রাহকের মেসেজ",
          tabBarIcon: ({ color, size }) => (
            <Mail size={size} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "সেটিংস",
          headerTitle: "নোটিফিকেশন সেটিংস",
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} strokeWidth={2.2} />
          ),
        }}
      />
    </Tabs>
  );
}
