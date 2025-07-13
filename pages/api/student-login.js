import { supabase } from '../../lib/db';
import { createStudentSession } from '../../lib/studentAuth';

/**
 * API endpoint for student login using first name and passcode
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firstName, passcode } = req.body;

    // Validate inputs
    if (!firstName || !passcode || passcode.length !== 6) {
      return res.status(400).json({ error: 'Invalid first name or passcode' });
    }

    // Find student by first name and passcode
    const { data: student, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'student')
      .eq('passcode', passcode)
      .ilike('first_name', firstName.trim())
      .single();

    if (error || !student) {
      return res.status(401).json({ error: 'Invalid first name or passcode' });
    }

    // Create a secure session token for the student
    const { token, expiresAt } = await createStudentSession(student.id);
    
    // Return student data with session token
    return res.status(200).json({ 
      success: true, 
      email: student.email,
      studentId: student.id,
      sessionToken: token,
      expiresAt: expiresAt,
      firstName: student.first_name,
      grade: student.grade
    });

  } catch (error) {
    console.error('Student login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
}