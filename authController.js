import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { get, run, query } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'globetrotter_super_secret_jwt_key_2026_travel';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 1. Register User
export async function register(req, res) {
  try {
    const { email, password, firstName, lastName, phone, city, country, bio, avatarUrl } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, password, first name, and last name are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const defaultAvatar = avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(firstName + lastName)}`;

    const { lastInsertRowid } = await run(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, city, country, bio, avatar_url, role, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 'USD')
    `, [
      email.toLowerCase().trim(),
      passwordHash,
      firstName.trim(),
      lastName.trim(),
      phone ? phone.trim() : null,
      city ? city.trim() : null,
      country ? country.trim() : null,
      bio ? bio.trim() : 'Exploring the world, one destination at a time.',
      defaultAvatar
    ]);

    const newUser = await get('SELECT id, email, first_name, last_name, phone, city, country, bio, avatar_url, role, currency, created_at FROM users WHERE id = ?', [lastInsertRowid]);
    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Account created successfully! Welcome to GlobeTrotter.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        phone: newUser.phone,
        city: newUser.city,
        country: newUser.country,
        bio: newUser.bio,
        avatarUrl: newUser.avatar_url,
        role: newUser.role,
        currency: newUser.currency,
        createdAt: newUser.created_at
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create account due to internal server error.' });
  }
}

// 2. Login User
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      message: `Welcome back, ${user.first_name}!`,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        city: user.city,
        country: user.country,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        role: user.role,
        currency: user.currency,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed due to internal server error.' });
  }
}

// 3. Get Current User Profile with Stats
export async function getMe(req, res) {
  try {
    const user = await get('SELECT id, email, first_name, last_name, phone, city, country, bio, avatar_url, role, currency, created_at FROM users WHERE id = ?', [req.user.id]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Dynamic travel statistics
    const tripsCount = await get('SELECT COUNT(*) as count FROM trips WHERE user_id = ?', [user.id]);
    const countriesCount = await get(`
      SELECT COUNT(DISTINCT c.country) as count 
      FROM trip_stops ts 
      JOIN trips t ON ts.trip_id = t.id 
      JOIN cities c ON ts.city_id = c.id 
      WHERE t.user_id = ?
    `, [user.id]);
    const activitiesCount = await get(`
      SELECT COUNT(*) as count 
      FROM trip_activities ta
      JOIN trip_stops ts ON ta.trip_stop_id = ts.id
      JOIN trips t ON ts.trip_id = t.id
      WHERE t.user_id = ?
    `, [user.id]);
    const savedCities = await query(`
      SELECT c.* FROM saved_destinations sd
      JOIN cities c ON sd.city_id = c.id
      WHERE sd.user_id = ?
      ORDER BY sd.created_at DESC
    `, [user.id]);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        city: user.city,
        country: user.country,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        role: user.role,
        currency: user.currency,
        createdAt: user.created_at
      },
      stats: {
        totalTrips: tripsCount ? tripsCount.count : 0,
        totalCountries: countriesCount ? countriesCount.count : 0,
        totalActivities: activitiesCount ? activitiesCount.count : 0,
        savedDestinationsCount: savedCities.length
      },
      savedDestinations: savedCities
    });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
}

// 4. Forgot Password / Reset
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await get('SELECT id, email, first_name FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      // Return safe message without exposing whether user exists
      return res.json({ message: 'If an account exists with this email, a password reset link has been dispatched.' });
    }

    // Reset password to default 'password123' for demonstration ease
    const tempPassword = 'password123';
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);

    res.json({
      message: `Password has been reset successfully! Your temporary password is: ${tempPassword}`,
      tempPassword
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Password reset request failed.' });
  }
}

// 5. Update Profile
export async function updateProfile(req, res) {
  try {
    const { firstName, lastName, phone, city, country, bio, avatarUrl, currency } = req.body;

    await run(`
      UPDATE users 
      SET first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          phone = ?,
          city = ?,
          country = ?,
          bio = ?,
          avatar_url = COALESCE(?, avatar_url),
          currency = COALESCE(?, currency),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [firstName, lastName, phone, city, country, bio, avatarUrl, currency, req.user.id]);

    const updated = await get('SELECT id, email, first_name, last_name, phone, city, country, bio, avatar_url, role, currency FROM users WHERE id = ?', [req.user.id]);

    res.json({
      message: 'Profile updated successfully!',
      user: {
        id: updated.id,
        email: updated.email,
        firstName: updated.first_name,
        lastName: updated.last_name,
        phone: updated.phone,
        city: updated.city,
        country: updated.country,
        bio: updated.bio,
        avatarUrl: updated.avatar_url,
        role: updated.role,
        currency: updated.currency
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
}

// 6. Change Password
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id]);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
}

// 7. Delete Account
export async function deleteAccount(req, res) {
  try {
    await run('DELETE FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: 'Account and all associated trips have been permanently deleted.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
}
