import { supabase } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firstName, passcode } = req.body;

    if (!firstName || !passcode) {
      return res.status(400).json({ error: 'Missing first name or passcode' });
    }

    // Find student by first name and verify passcode
    const { data: students, error } = await supabase
      .from('users')
      .select('*')
      .eq('first_name', firstName.toLowerCase())
      .eq('role', 'student')
      .eq('account_type', 'trial');

    if (error || !students || students.length === 0) {
      return res.status(401).json({ error: 'Invalid first name or passcode' });
    }

    // Check passcode for each matching student
    let validStudent = null;
    for (const student of students) {
      if (student.passcode && passcode === student.passcode) {
        validStudent = student;
        break;
      }
    }

    if (!validStudent) {
      return res.status(401).json({ error: 'Invalid first name or passcode' });
    }

    // Return email and a temporary password for Firebase auth
    // In production, you might want to use a more secure method
    const tempPassword = validStudent.passcode + 'Aa1!';

    return res.status(200).json({
      success: true,
      email: validStudent.email,
      tempPassword: tempPassword,
      userId: validStudent.id
    });

  } catch (error) {
    console.error('Student login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}