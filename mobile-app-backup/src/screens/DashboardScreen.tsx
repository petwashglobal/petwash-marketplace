// Dashboard - Employee Home Screen
// Shows today's tasks, quick actions, and stats

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { petWashApi } from '../api/petWashApi';
import type { WashTask, Employee } from '../types';

interface Props {
  employee: Employee;
  navigation: any;
}

export const DashboardScreen: React.FC<Props> = ({ employee, navigation }) => {
  const [tasks, setTasks] = useState<WashTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const todaysTasks = await petWashApi.getTodaysTasks(employee.uid);
      setTasks(todaysTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.employeeName}>{employee.fullName}</Text>
          <Text style={styles.roleText}>{employee.role.toUpperCase()}</Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard
          number={tasks.length}
          label="Total Tasks"
          color="#007AFF"
        />
        <StatCard
          number={completedTasks}
          label="Completed"
          color="#34C759"
        />
        <StatCard
          number={pendingTasks + inProgressTasks}
          label="Remaining"
          color="#FF9500"
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionButton
            icon="📱"
            label="Station Control"
            onPress={() => navigation.navigate('StationControl')}
          />
          <ActionButton
            icon="📋"
            label="Tasks"
            onPress={() => navigation.navigate('Tasks')}
          />
          <ActionButton
            icon="📷"
            label="QR Scanner"
            onPress={() => navigation.navigate('QRScanner')}
          />
          <ActionButton
            icon="📊"
            label="Schedule"
            onPress={() => navigation.navigate('Schedule')}
          />
        </View>
      </View>

      {/* Today's Tasks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Tasks</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" />
        ) : tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>✨</Text>
            <Text style={styles.emptyStateText}>No tasks for today</Text>
          </View>
        ) : (
          tasks.slice(0, 5).map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => navigation.navigate('TaskDetails', { taskId: task.id })}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
};

const StatCard: React.FC<{ number: number; label: string; color: string }> = ({
  number,
  label,
  color,
}) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={[styles.statNumber, { color }]}>{number}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ActionButton: React.FC<{ icon: string; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <Text style={styles.actionIcon}>{icon}</Text>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const TaskCard: React.FC<{ task: WashTask; onPress: () => void }> = ({ task, onPress }) => {
  const statusColor =
    task.status === 'completed'
      ? '#34C759'
      : task.status === 'in_progress'
      ? '#FF9500'
      : '#8E8E93';

  return (
    <TouchableOpacity style={styles.taskCard} onPress={onPress}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskPetName}>🐾 {task.petName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusBadgeText}>
            {task.status.replace('_', ' ')}
          </Text>
        </View>
      </View>
      <Text style={styles.taskCustomer}>Customer: {task.customerName}</Text>
      <Text style={styles.taskTime}>
        ⏰ {new Date(task.scheduledTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  greeting: {
    fontSize: 16,
    color: '#8E8E93',
  },
  employeeName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: '48%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  taskCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskPetName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  taskCustomer: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  taskTime: {
    fontSize: 14,
    color: '#007AFF',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

export default DashboardScreen;
