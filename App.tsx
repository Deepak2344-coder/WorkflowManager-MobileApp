import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import AuthScreen from "./src/screens/AuthScreen";
import Dashboard from "./src/screens/Dashboard";
import MyTeamsScreen from "./src/screens/MyTeamsScreen";
import TeamDetailScreen from "./src/screens/TeamDetailScreen";
import TeamTaskDetailScreen from "./src/screens/TeamTaskDetailScreen";
import CommonDashboard from "./src/screens/CommonDashboard";
import TaskHistory from "./src/screens/TaskHistory";
import AdminPanel from "./src/screens/AdminPanel";
import HamburgerMenu from "./src/components/HamburgerMenu";
import DevMenu from "./src/components/DevMenu";
import { usePushNotifications } from "./src/hooks/usePushNotifications";
import { supabase } from "./src/lib/supabase";
import UsernamePrompt from "./src/screens/UsernamePrompt";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerRight: () => <HamburgerMenu /> }}>
      <Tab.Screen name="Dashboard" component={Dashboard} options={{ headerTitle: () => <DevMenu /> }} />
      <Tab.Screen name="Common" component={CommonDashboard} options={{ title: "All Tasks" }} />
      <Tab.Screen name="MyTeams" component={MyTeamsScreen} options={{ title: "My Teams" }} />
      <Tab.Screen name="History" component={TaskHistory} options={{ title: "Task History" }} />
      {Platform.OS === "web" && (
        <Tab.Screen name="Admin" component={AdminPanel} options={{ title: "Admin" }} />
      )}
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { session, loading, user } = useAuth();
  const [needsUsername, setNeedsUsername] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  usePushNotifications();

  useEffect(() => {
    if (!user) { setCheckingProfile(false); return; }
    supabase.from("members").select("id, full_name").eq("id", user.id).single().then(({ data }) => {
      setNeedsUsername(!data?.full_name);
      setCheckingProfile(false);
    });
  }, [user]);

  const handleProfileSaved = () => {
    setNeedsUsername(false);
  };

  if (loading || checkingProfile) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session && <Stack.Screen name="Auth" component={AuthScreen} />}
        {session && needsUsername && <Stack.Screen name="UsernamePrompt">{() => <UsernamePrompt onComplete={handleProfileSaved} />}</Stack.Screen>}
        {session && !needsUsername && <Stack.Screen name="Main" component={MainTabs} />}
        {session && !needsUsername && <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />}
        {session && !needsUsername && <Stack.Screen name="TeamTaskDetail" component={TeamTaskDetailScreen} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
