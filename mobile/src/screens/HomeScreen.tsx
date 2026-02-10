import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, Recall, Stats } from '../api/client';
import { RecallCard } from '../components/RecallCard';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async (searchTerm?: string) => {
    try {
      const [recallData, statsData] = await Promise.all([
        api.getRecalls({ limit: 30, search: searchTerm || undefined }),
        api.getStats(),
      ]);
      setRecalls(recallData.data);
      setTotal(recallData.total);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(search);
  }, [fetchData, search]);

  const onSearch = useCallback(() => {
    setLoading(true);
    fetchData(search);
  }, [fetchData, search]);

  if (loading && recalls.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0068B4" />
        <Text style={styles.loadingText}>Chargement des alertes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Banner */}
      {stats && (
        <View style={styles.statsBanner}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.active_recalls}</Text>
            <Text style={styles.statLabel}>Rappels actifs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.infant_formula_recalls}</Text>
            <Text style={styles.statLabel}>Laits infantiles</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.tracked_barcodes}</Text>
            <Text style={styles.statLabel}>Codes-barres</Text>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un produit, marque..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={onSearch}>
          <Text style={styles.searchButtonText}>Rechercher</Text>
        </TouchableOpacity>
      </View>

      {/* Results count */}
      <Text style={styles.resultCount}>
        {total} rappel{total !== 1 ? 's' : ''} trouvé{total !== 1 ? 's' : ''}
      </Text>

      {/* Recall List */}
      <FlatList
        data={recalls}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <RecallCard
            recall={item}
            onPress={() => navigation.navigate('RecallDetail', { id: item.id })}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0068B4']} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Aucun rappel trouvé</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#0068B4',
    paddingVertical: 16,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#cce0f0',
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
  },
  searchButton: {
    marginLeft: 8,
    backgroundColor: '#0068B4',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  resultCount: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 13,
    color: '#888',
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
