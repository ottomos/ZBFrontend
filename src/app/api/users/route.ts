import { NextRequest, NextResponse } from "next/server";
import { canAccessUserManagement, canCreateAdminUsers } from "@/lib/auth";
import { sendMail } from "@/lib/mail";

// DB API base URL - our new database API
const DB_API_URL = process.env.NEXT_PUBLIC_DB_API_URL;

// Helper function to get user from session using DB API
async function getUserFromRequest(request: NextRequest) {
  const sessionToken = request.cookies.get("session")?.value;
  if (!sessionToken) {
    throw new Error("No session found");
  }
  
  // Find session via DB API
  const sessionsResponse = await fetch(`${DB_API_URL}/sessions`);
  if (!sessionsResponse.ok) {
    throw new Error('Failed to fetch sessions from DB API');
  }
  
  const sessionsData = await sessionsResponse.json();
  const session = sessionsData.data.find((s: any) => s.token === sessionToken);
  
  if (!session) {
    throw new Error("Session not found");
  }
  
  // Check session expiration. Sessions are stored in Kuwait local time (T+3),
  // so compare against the same shifted clock.
  if (new Date(session.expiresAt) < new Date(Date.now() + 3 * 60 * 60 * 1000)) {
    await fetch(`${DB_API_URL}/sessions/${session.id}`, { method: 'DELETE' });
    throw new Error("Session expired");
  }
  
  // Get user info via DB API
  const userResponse = await fetch(`${DB_API_URL}/users/${session.userId}`);
  if (!userResponse.ok) {
    throw new Error('Failed to fetch user from DB API');
  }
  
  const userData = await userResponse.json();
  if (!userData.success) {
    throw new Error("User not found");
  }
  
  return userData.data;
}

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    console.log("[GET /api/users] currentUser:", currentUser);

    if (!canAccessUserManagement(currentUser.role)) {
      console.log("[GET /api/users] Insufficient permissions for role:", currentUser.role);
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Always use CoE for backend fetch, then filter for frontend permissions
    const usersResponse = await fetch(`${DB_API_URL}/users?role=CoE`);
    const rawText = await usersResponse.text();
    console.log('[GET /api/users] db-api status:', usersResponse.status);
    console.log('[GET /api/users] db-api raw text:', rawText);
    let usersData = null;
    try {
      usersData = JSON.parse(rawText);
      console.log('[GET /api/users] db-api response:', usersData);
    } catch (err) {
      console.error('[GET /api/users] Error parsing db-api response:', err);
      console.log('[GET /api/users] Returning parse error');
      return NextResponse.json(
        { success: false, error: 'Failed to parse db-api response' },
        { status: 500 }
      );
    }
    if (!usersResponse.ok || !usersData || !usersData.success) {
      console.error('[GET /api/users] db-api error:', usersData);
      console.log('[GET /api/users] Returning db-api error');
      return NextResponse.json(
        { success: false, error: usersData?.error || 'Failed to fetch users from DB API' },
        { status: usersResponse.status }
      );
    }
    let filteredUsers = usersData.data;
    // Entity Admin: only users from their entity
    if (currentUser.role === 'Entity Admin') {
      filteredUsers = filteredUsers.filter((u: any) => u.entity === currentUser.entity);
    }
    // Group Head Trader: can see all users (no filter)
    // CoE, Management: can see all users (no filter)
    console.log('[GET /api/users] Returning filtered users:', filteredUsers);
    return NextResponse.json({ success: true, users: filteredUsers });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Shared update flow used by POST (when body.id present) and PUT (compat)
async function updateUserFlow(body: any, currentUser: any) {
  try {
    // Safe list: Only allow these fields to be updated
    const allowedFields = ["id", "username", "email", "password", "entity", "name", "surname", "gsm"];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (field === "password") {
        if (body.password && body.password.trim() !== "") {
          updateData.password = body.password;
        }
      } else if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { id } = updateData;
    if (!id) {
      console.log('[updateUserFlow] Missing required field: id');
      return NextResponse.json(
        { success: false, error: "ID is required" },
        { status: 400 }
      );
    }

    // IDOR validation: Only allow users to update their own account unless admin
    if (currentUser.id !== id) {
      if (!canAccessUserManagement(currentUser.role)) {
        console.log('[updateUserFlow] Insufficient permissions for role:', currentUser.role);
        return NextResponse.json(
          { success: false, error: "Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    // Role-based access control: Only admins can update role, status, or permissions
    if (body.role !== undefined || body.status !== undefined || body.permissions !== undefined) {
      if (!canAccessUserManagement(currentUser.role)) {
        return NextResponse.json(
          { success: false, error: "Only admins can update role, status, or permissions." },
          { status: 403 }
        );
      }
      if (body.role !== undefined) updateData.role = body.role;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.permissions !== undefined) updateData.permissions = body.permissions;
    }

    // Prevent traders from being assigned COE permissions
    if (updateData.role === "trader" && Array.isArray(updateData.permissions) && updateData.permissions.includes("COE")) {
      return NextResponse.json(
        { success: false, error: "Traders cannot have COE permissions." },
        { status: 403 }
      );
    }

    // Validate some fields if provided
    if (updateData.username !== undefined && !updateData.username) {
      return NextResponse.json(
        { success: false, error: "Username cannot be empty" },
        { status: 400 }
      );
    }
    if (updateData.email !== undefined && !updateData.email) {
      return NextResponse.json(
        { success: false, error: "Email cannot be empty" },
        { status: 400 }
      );
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (updateData.email !== undefined && !emailRegex.test(updateData.email)) {
      console.log('[updateUserFlow] Invalid email format:', updateData.email);
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check for duplicate email or username (excluding current user)
    const usersResponse = await fetch(`${DB_API_URL}/users?role=CoE`);
    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users from DB API');
    }
    const usersData = await usersResponse.json();
    const existingUser = usersData.data.find((u: any) => 
      u.id !== id && (
        (updateData.email !== undefined && u.email === updateData.email) || 
        (updateData.username !== undefined && u.username === updateData.username)
      )
    );

    if (existingUser) {
      console.log('[updateUserFlow] Duplicate user found:', existingUser);
      if (updateData.email !== undefined && existingUser.email === updateData.email) {
        return NextResponse.json(
          { success: false, error: "Another user with this email already exists" },
          { status: 400 }
        );
      } else if (updateData.username !== undefined && existingUser.username === updateData.username) {
        return NextResponse.json(
          { success: false, error: "Another user with this username already exists" },
          { status: 400 }
        );
      }
    }

    // Map frontend role to backend role
    const dbRole = updateData.role;
    const entity = updateData.entity;

    // Dealer is an entity-level role and cannot be assigned to the group ('All') scope.
    if (dbRole === 'Dealer' && entity === 'All') {
      return NextResponse.json(
        { success: false, error: "Dealer must belong to a specific entity." },
        { status: 400 }
      );
    }

    // Group Head Trader: can only edit other users in KFH, and only to allowed roles
    if (currentUser.role === 'Group Head Trader' && currentUser.id !== id) {
      const allowedRoles = ['entity admin', 'entity trader', 'entity viewer', 'dealer'];
      if (
        entity !== 'KFH' ||
        !allowedRoles.includes((dbRole || '').toLowerCase())
      ) {
        return NextResponse.json(
          { success: false, error: "Group Head Trader can only assign Entity Admin, Entity Trader, Entity Viewer, or Dealer in KFH." },
          { status: 403 }
        );
      }
    }
    if ((dbRole === 'admin' || dbRole === 'super_admin') && !canCreateAdminUsers(currentUser.role)) {
      console.log('[updateUserFlow] Insufficient permissions to assign admin roles:', dbRole);
      return NextResponse.json(
        { success: false, error: "Insufficient permissions to assign admin roles" },
        { status: 403 }
      );
    }

    console.log('[updateUserFlow] Update data:', updateData);

    // Update user via DB API using POST (DB accepts POST-based updates)
    const updateUrl = `${DB_API_URL}/users/${id}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      const respText = await updateResponse.text().catch(() => null);
      let errorData: any = null;
      try { errorData = respText ? JSON.parse(respText) : null; } catch (_) { /* ignore */ }
      return NextResponse.json(
        { success: false, error: errorData?.error || respText || "Failed to update user" },
        { status: updateResponse.status }
      );
    }

    const updatedUserData = await updateResponse.json();
    const updatedUser = updatedUserData.data;
    console.log('[updateUserFlow] Updated user:', updatedUser);

    const formattedUser = {
      id,
      dbId: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      permissions: updatedUser.permissions,
      gsm: updatedUser.gsm,
      name: updatedUser.name,
      surname: updatedUser.surname,
      entity: updatedUser.entity,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };
    console.log('[updateUserFlow] Formatted updated user for frontend:', formattedUser);

    return NextResponse.json({ success: true, user: formattedUser });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    console.log('[POST /api/users] ENTRY: currentUser:', currentUser);

    const body = await request.json();

    // API compatibility: some networks block HTTP DELETE. Accept POST with delete action.
    if (body && (body.action === 'delete' || body._method === 'DELETE' || body.delete === true)) {
      if (!canAccessUserManagement(currentUser.role)) {
        console.log('[POST /api/users] Compatibility delete permission denied for role:', currentUser.role);
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }
      const id = body.id;
      if (!id) {
        return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
      }
      if (id === currentUser.id) {
        return NextResponse.json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });
      }

      // Forward as POST to DB API which accepts POST-delete compatibility
      try {
        const resp = await fetch(`${DB_API_URL}/users/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete' })
        });
        const respText = await resp.text().catch(() => null);
        let respData: any = null;
        try { respData = respText ? JSON.parse(respText) : null; } catch (_) { respData = respText; }
        if (!resp.ok) {
          return NextResponse.json({ success: false, error: respData?.error || respText || 'Failed to delete user' }, { status: resp.status });
        }
        return NextResponse.json({ success: true });
      } catch (err) {
        console.error('[POST /api/users] Error forwarding delete to DB API:', err);
        return NextResponse.json({ success: false, error: 'Failed to delete user (network error)' }, { status: 502 });
      }
    }

    // If body contains an id, treat this POST as an update request
    if (body && body.id) {
      // Delegate to shared update flow
      return await updateUserFlow(body, currentUser);
    }

    if (currentUser.role !== 'Group Head Trader' && !canAccessUserManagement(currentUser.role)) {
      console.log('[POST /api/users] Permission denied for role:', currentUser.role);
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    let { username, email, password, role, name, surname, gsm, entity, status, permissions } = body;
    // Default role logic if not provided
    if (!role) {
      if (currentUser.role === 'Group Head Trader') {
        role = 'Entity Admin';
      } else if (currentUser.role === 'Entity Admin') {
        role = 'Entity Viewer';
      } else if (entity === 'All') {
        role = 'CoE';
      }
    }
    console.log('[POST /api/users] Requested role:', role, 'Requested entity:', entity);

    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Username, email, and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check for duplicate email or username via DB API (always use CoE role)
    const usersResponse = await fetch(`${DB_API_URL}/users?role=CoE`);
    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users from DB API');
    }
    const usersData = await usersResponse.json();
    const existingUser = usersData.data.find((u: any) => 
      u.email === email || u.username === username
    );

    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json(
          { success: false, error: "A user with this email already exists" },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { success: false, error: "A user with this username already exists" },
          { status: 400 }
        );
      }
    }

    // Check role permissions
    const dbRole = role;
    // Dealer is an entity-level role and cannot be assigned to the group ('All') scope.
    if (dbRole === 'Dealer' && entity === 'All') {
      return NextResponse.json(
        { success: false, error: "Dealer must belong to a specific entity." },
        { status: 400 }
      );
    }
    // Entity Admins can only create Entity Traders, Entity Viewers or Dealers for their own entity
    if (currentUser.role === 'Entity Admin') {
      console.log('[POST /api/users] Entity Admin add attempt:', { entity, dbRole });
      if (
        (dbRole !== 'Entity Trader' && dbRole !== 'Entity Viewer' && dbRole !== 'Dealer') ||
        entity !== currentUser.entity
      ) {
        return NextResponse.json(
          { success: false, error: "Entity Admins can only add Entity Traders, Entity Viewers and Dealers to their own entity." },
          { status: 403 }
        );
      }
    }
    // Group Head Trader: can only add users in KFH, and only Entity Admin, Entity Trader, Entity Viewer, Dealer
    if (currentUser.role === 'Group Head Trader') {
      // Normalize role: lowercase, remove spaces, underscores, dashes
      const normalize = (str: string) => (str || '').toLowerCase().replace(/[^a-z]/g, '');
      const allowedRoles = ['entityadmin', 'entitytrader', 'entityviewer', 'dealer'];
      const normalizedRole = normalize(dbRole);
      console.log('[POST /api/users] Group Head Trader add attempt:', { entity, dbRole, normalizedRole });
      if (
        entity !== 'KFH' ||
        !allowedRoles.includes(normalizedRole)
      ) {
        return NextResponse.json(
          { success: false, error: `Group Head Trader can only add Entity Admin, Entity Trader, Entity Viewer, or Dealer in KFH. (entity=${entity}, role=${role}, normalizedRole=${normalizedRole})` },
          { status: 403 }
        );
      }
    }
    // Only CoE and super_admin can create admin users
    if ((dbRole === 'admin' || dbRole === 'super_admin') && !canCreateAdminUsers(currentUser.role)) {
      console.log('[POST /api/users] Admin add attempt denied:', { dbRole, currentUserRole: currentUser.role });
      return NextResponse.json(
        { success: false, error: "Insufficient permissions to create admin users" },
        { status: 403 }
      );
    }

    // Create new user via DB API
    const createUserResponse = await fetch(`${DB_API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email,
        password,
        role: dbRole,
        name,
        surname,
        gsm,
        entity,
        status: status || 'Active',
        permissions: permissions || []
      })
    });

    if (!createUserResponse.ok) {
      const errorData = await createUserResponse.json();
      return NextResponse.json(
        { success: false, error: errorData.error || "Failed to create user" },
        { status: createUserResponse.status }
      );
    }

    const newUserData = await createUserResponse.json();
    const newUser = newUserData.data;

    // Send password email using nodemailer via send-mail
    // Send password email using fetch to local API route
    try {
      await sendMail({
        to: email,
        subject: 'Your KFH APM Dashboard account created!',
        text: `Dear ${name},\n\nWelcome to the KFH APM Dashboard platform!\n\nYour account has been successfully created. Please find your login details below:\n\nUsername: ${username}\nPassword: ${password}\n\nFor your security, please change your password after your first login.\n\nIf you have any questions or need assistance, feel free to contact our support team.\n\nBest regards,\nKFH Center of Excellence\n`
      });
    } catch (mailError) {
      console.error('Error sending password email:', mailError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        surname: newUser.surname,
        gsm: newUser.gsm,
        entity: newUser.entity,
        status: newUser.status,
        permissions: newUser.permissions
      }
    });
  } catch (error) {
    console.error("Create user error:", error);
    if (error instanceof Error && error.message.includes("already exists")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/users - Update a user
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request);
    const body = await request.json();
    return await updateUserFlow(body, currentUser);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE handler intentionally removed.
// Deletions must be performed via POST to this route using an explicit action flag,
// e.g. POST /api/users with body { action: 'delete', id: '<userId>' }.
// This avoids environments where HTTP DELETE is blocked by network proxies.
