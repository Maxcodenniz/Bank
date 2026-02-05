-- Add comprehensive music genres to the genres table
-- This expands the genre selection for artists

INSERT INTO genres (name, category) VALUES
  -- Latin & Caribbean
  ('Latin', 'music'),
  ('Salsa', 'music'),
  ('Bachata', 'music'),
  ('Reggaeton', 'music'),
  ('Merengue', 'music'),
  ('Cumbia', 'music'),
  ('Soca', 'music'),
  ('Calypso', 'music'),
  ('Dancehall', 'music'),
  ('Zouk', 'music'),
  
  -- Asian Pop
  ('K-Pop', 'music'),
  ('J-Pop', 'music'),
  ('C-Pop', 'music'),
  ('Bollywood', 'music'),
  
  -- Rock Subgenres
  ('Indie Rock', 'music'),
  ('Alternative Rock', 'music'),
  ('Punk', 'music'),
  ('Hard Rock', 'music'),
  ('Progressive Rock', 'music'),
  ('Grunge', 'music'),
  ('Post-Rock', 'music'),
  ('Shoegaze', 'music'),
  
  -- Hip Hop Subgenres
  ('Rap', 'music'),
  ('Trap', 'music'),
  ('Drill', 'music'),
  ('Boom Bap', 'music'),
  ('Conscious Hip Hop', 'music'),
  
  -- Electronic Subgenres
  ('Trance', 'music'),
  ('Dubstep', 'music'),
  ('Drum & Bass', 'music'),
  ('Garage', 'music'),
  ('UK Garage', 'music'),
  ('Grime', 'music'),
  ('Bass', 'music'),
  ('Future Bass', 'music'),
  ('Synthwave', 'music'),
  ('Lo-Fi', 'music'),
  ('Chillout', 'music'),
  ('Downtempo', 'music'),
  ('Trip Hop', 'music'),
  
  -- Jazz Subgenres
  ('Acid Jazz', 'music'),
  ('Smooth Jazz', 'music'),
  ('Bebop', 'music'),
  ('Swing Jazz', 'music'),
  ('Latin Jazz', 'music'),
  ('Free Jazz', 'music'),
  
  -- African Genres
  ('Afrobeat', 'music'),
  ('Afrofusion', 'music'),  
  ('Highlife', 'music'),
  ('Hip-Life', 'music'),
  ('Afro-Pop', 'music'),
  ('Afro-Reggae', 'music'),
  ('Afro-R&B', 'music'),
  ('Afro-Soul', 'music'),
  ('Afro-Funk', 'music'),
  ('Afro-Disco', 'music'),
  ('Afro-House', 'music'),
  ('Afro-Tech', 'music'),
  ('Afro-Tech House', 'music'),
  ('Afro-Soul', 'music'),
  ('Afro-Funk', 'music'),
  ('Afro-House', 'music'),
  ('Afro-Tech', 'music'),
  ('Afro-Tech House', 'music'),
  ('Afro-Jazz', 'music'),
  ('Afro-Samba', 'music'),
  ('Afro-Bossa Nova', 'music'),
  ('Afro-Funk', 'music'),
  ('Afro-Disco', 'music'),
  ('Afro-House', 'music'),
  ('Afro-Tech', 'music'),
  ('Afro-Tech House', 'music'),
  ('Afro-Soul', 'music'),
  ('Afro-Funk', 'music'),
  ('Afro-Disco', 'music'),
  ('Afro-Tech House', 'music'),
  ('Juju', 'music'),
  ('Fuji', 'music'),
  ('Amapiano', 'music'),
  ('Gqom', 'music'),
  ('Kwaito', 'music'),
  ('Kisomba', 'music'),
  ('Congolese Rumba', 'music'),
  ('Congolese Soukous', 'music'),
  ('Congolese Makossa', 'music'),
  ('Congolese Bemba', 'music'),
  ('Congolese Lingala', 'music'),
  ('Congolese Kongo', 'music'),
  ('Congolese Kizomba', 'music'),
  ('Congolese Kizomba', 'music'),
  ('Bongo Flava', 'music'),
  ('Azonto', 'music'),
  ('Kuduro', 'music'),
  ('Zouk', 'music'),
  ('Zouk-Love', 'music'),
  ('Ndombolo', 'music'),


  -- Middle Eastern & North African
  ('Rai', 'music'),
  ('Chaabi', 'music'),
  ('Gnawa', 'music'),
  ('Malouf', 'music'),
  ('Arabic Pop', 'music'),
  
  -- Classical & Orchestral
  ('Opera', 'music'),
  ('Orchestral', 'music'),
  ('Chamber Music', 'music'),
  ('Symphony', 'music'),
  
  
  -- Other Genres
  ('World Music', 'music'),
  ('Traditional', 'music'),
  ('New Age', 'music'),
  ('Ska', 'music'),
  ('Swing', 'music'),
  ('Bossa Nova', 'music'),
  ('Samba', 'music'),
  ('Flamenco', 'music'),
  ('Bluegrass', 'music'),
  ('Country Rock', 'music'),
  ('Folk Rock', 'music'),
  ('Indie Pop', 'music'),
  ('Synth Pop', 'music'),
  ('New Wave', 'music'),
  ('Post-Punk', 'music')
ON CONFLICT (name) DO NOTHING;





