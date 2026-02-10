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
import { api, Recall } from '../api/client';
import { RecallCard } from '../components/RecallCard';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function InfantFormulaScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async (searchTerm?: string) => {
    try {
      const data = await api.getInfantFormulaRecalls({
        limit: 100,
        search: searchTerm || undefined,
      });
      setRecalls(data.data);
      setTotal(data.total);
    } catch (err) {
      console.error('Error fetching infant formula recalls:', err);
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
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerTitle}>Rappels de laits infantiles</Text>
        <Text style={styles.infoBannerText}>
          Liste complète des produits de laits infantiles concernés par des rappels au Luxembourg.
          Cette liste est mise à jour régulièrement.
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par marque, produit..."
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

      <Text style={styles.resultCount}>
        {total} produit{total !== 1 ? 's' : ''} rappelé{total !== 1 ? 's' : ''}
      </Text>

      <FlatList
        data={recalls}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <RecallCard
            recall={item}
            onPress={() => navigation.navigate('RecallDetail', { id: item.id })}
            highlight
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0068B4']} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              Aucun rappel de lait infantile trouvé
            </Text>
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
  infoBanner: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
  },
  infoBannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#664D03',
    marginBottom: 6,
  },
  infoBannerText: {
    fontSize: 13,
    color: '#664D03',
    lineHeight: 19,
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
