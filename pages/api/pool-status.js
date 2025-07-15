import { createClient } from '@supabase/supabase-js';
import { EDUCATIONAL_TOPICS } from '../../lib/utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MIN_POOL_SIZE = 20;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get pool statistics
    const stats = [];
    const lowPools = [];
    
    const grades = [5, 6, 7, 8, 9, 10, 11];
    
    for (const [topic, config] of Object.entries(EDUCATIONAL_TOPICS)) {
      for (const grade of grades) {
        for (const difficulty of config.complexityLevels || [1, 2, 3, 4, 5, 6, 7, 8]) {
          const { count, error } = await supabase
            .from('question_cache')
            .select('*', { count: 'exact', head: true })
            .eq('topic', topic)
            .eq('grade', grade)
            .eq('difficulty', difficulty)
            .is('expires_at', null);
            
          if (!error) {
            const poolInfo = {
              topic,
              grade,
              difficulty,
              count: count || 0
            };
            
            stats.push(poolInfo);
            
            if (poolInfo.count < MIN_POOL_SIZE) {
              lowPools.push(poolInfo);
            }
          }
        }
      }
    }
    
    // Get total count
    const { count: totalCount } = await supabase
      .from('question_cache')
      .select('*', { count: 'exact', head: true })
      .is('expires_at', null);
    
    return res.status(200).json({
      totalQuestions: totalCount || 0,
      minPoolSize: MIN_POOL_SIZE,
      lowPools,
      needsReplenishment: lowPools.length > 0,
      stats: stats.slice(0, 10) // Sample of stats
    });
    
  } catch (error) {
    console.error('Error checking pool status:', error);
    return res.status(500).json({ error: 'Failed to check pool status' });
  }
}