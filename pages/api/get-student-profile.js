import { createClient } from '@supabase/supabase-js';
import { validateStudentSession } from '../../lib/studentAuth';

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * API endpoint to get student profile
 * Validates student session before returning profile
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentId } = req.body;
    const authHeader = req.headers.authorization;

    // Validate student session
    if (!authHeader || !authHeader.startsWith('Student ')) {
      return res.status(401).json({ error: 'No student session provided' });
    }

    const token = authHeader.replace('Student ', '');
    const studentData = await validateStudentSession(token);

    if (!studentData || studentData.id !== studentId) {
      return res.status(401).json({ error: 'Invalid session or unauthorized access' });
    }

    // Get student profile using service role
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', studentId)
      .eq('role', 'student')
      .single();

    if (error || !profile) {
      console.error('Error fetching student profile:', error);
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.status(200).json(profile);

  } catch (error) {
    console.error('Get student profile error:', error);
    return res.status(500).json({ error: 'Failed to get student profile' });
  }
}