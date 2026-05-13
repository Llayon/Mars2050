-- Enable RLS for all tables
ALTER TABLE public.colonies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_types ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own colonies" ON public.colonies;
DROP POLICY IF EXISTS "Users can insert own colonies" ON public.colonies;
DROP POLICY IF EXISTS "Users can update own colonies" ON public.colonies;
DROP POLICY IF EXISTS "Users can view resources of own colonies" ON public.resources;
DROP POLICY IF EXISTS "Users can update resources of own colonies" ON public.resources;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.resources;
DROP POLICY IF EXISTS "Users can view buildings of own colonies" ON public.buildings;
DROP POLICY IF EXISTS "Users can manage buildings of own colonies" ON public.buildings;
DROP POLICY IF EXISTS "Users can insert own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Users can view own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Users can update own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Users can delete own buildings" ON public.buildings;
DROP POLICY IF EXISTS "Allow all for development" ON public.buildings;
DROP POLICY IF EXISTS "Authenticated users can view map locations" ON public.map_locations;
DROP POLICY IF EXISTS "Authenticated users can update discovered locations" ON public.map_locations;
DROP POLICY IF EXISTS "Authenticated users can view map" ON public.map_locations;

-- ===== PROFILES =====
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ===== COLONIES =====
-- Read: users can see their own colonies
CREATE POLICY "Users can view own colonies" ON public.colonies
  FOR SELECT USING (auth.uid() = user_id);
-- Write: users can create colonies
CREATE POLICY "Users can insert own colonies" ON public.colonies
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Update: users can update their own colonies
CREATE POLICY "Users can update own colonies" ON public.colonies
  FOR UPDATE USING (auth.uid() = user_id);

-- ===== RESOURCES =====
-- Read: users can see resources of their colonies
CREATE POLICY "Users can view own resources" ON public.resources
  FOR SELECT USING (
    colony_id IN (SELECT id FROM public.colonies WHERE user_id = auth.uid())
  );

-- ===== BUILDINGS =====
-- Read: users can see buildings of their colonies
CREATE POLICY "Users can view own buildings" ON public.buildings
  FOR SELECT USING (
    colony_id IN (SELECT id FROM public.colonies WHERE user_id = auth.uid())
  );

-- ===== MAP LOCATIONS =====
-- Read: all authenticated users can see the map
CREATE POLICY "Authenticated users can view map" ON public.map_locations
  FOR SELECT USING (auth.role() = 'authenticated');

-- ===== BUILDING TYPES =====
-- Read: all authenticated users can see building types
CREATE POLICY "Authenticated users can view building types" ON public.building_types
  FOR SELECT USING (auth.role() = 'authenticated');