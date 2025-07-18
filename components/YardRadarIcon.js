// components/YardRadarIcon.js
import React from 'react';
import Svg, { 
  Circle, 
  Defs, 
  LinearGradient, 
  RadialGradient, 
  Stop, 
  Line, 
  Path, 
  G, 
  Rect, 
  Polygon, 
  Text 
} from 'react-native-svg';

const YardRadarIcon = ({ size = 120, animate = true }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Background Circle */}
      <Circle cx="60" cy="60" r="60" fill="url(#gradient1)"/>
      
      {/* Gradient Definitions */}
      <Defs>
        <LinearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#4A90E2" stopOpacity="1" />
          <Stop offset="100%" stopColor="#357ABD" stopOpacity="1" />
        </LinearGradient>
        
        <RadialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <Stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.2" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
        </RadialGradient>

        <RadialGradient id="sweepGradient" cx="0%" cy="0%" r="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
        </RadialGradient>
      </Defs>
      
      {/* Radar Background Circle */}
      <Circle cx="60" cy="60" r="35" fill="url(#radarGradient)" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.8"/>
      
      {/* Radar Grid Lines */}
      <Circle cx="60" cy="60" r="15" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.6"/>
      <Circle cx="60" cy="60" r="25" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.5"/>
      
      {/* Radar Cross Lines */}
      <Line x1="25" y1="60" x2="95" y2="60" stroke="#FFFFFF" strokeWidth="1" opacity="0.5"/>
      <Line x1="60" y1="25" x2="60" y2="95" stroke="#FFFFFF" strokeWidth="1" opacity="0.5"/>
      
      {/* Static Radar Sweep (no animation for now) */}
      <Path d="M 60 60 L 60 25 A 35 35 0 0 1 85 45 Z" fill="url(#sweepGradient)" opacity="0.7"/>
      
      {/* House/Yard Sale Icons */}
      {/* House 1 */}
      <G transform="translate(45, 40)">
        <Rect x="0" y="6" width="8" height="8" fill="#FFD700" rx="1"/>
        <Polygon points="0,6 4,2 8,6" fill="#FF6B6B"/>
        <Rect x="2" y="10" width="2" height="4" fill="#8B4513"/>
      </G>
      
      {/* House 2 */}
      <G transform="translate(70, 50)">
        <Rect x="0" y="6" width="8" height="8" fill="#98FB98" rx="1"/>
        <Polygon points="0,6 4,2 8,6" fill="#FF6B6B"/>
        <Rect x="2" y="10" width="2" height="4" fill="#8B4513"/>
      </G>
      
      {/* House 3 */}
      <G transform="translate(38, 70)">
        <Rect x="0" y="6" width="8" height="8" fill="#87CEEB" rx="1"/>
        <Polygon points="0,6 4,2 8,6" fill="#FF6B6B"/>
        <Rect x="2" y="10" width="2" height="4" fill="#8B4513"/>
      </G>
      
      {/* Sale Price Tags */}
      <Circle cx="50" cy="48" r="3" fill="#FFD700" stroke="#FFFFFF" strokeWidth="0.5"/>
      <Text x="50" y="52" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="4" fontWeight="bold" fill="#333">$</Text>
      
      <Circle cx="75" cy="58" r="3" fill="#FFD700" stroke="#FFFFFF" strokeWidth="0.5"/>
      <Text x="75" y="62" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="4" fontWeight="bold" fill="#333">$</Text>
      
      {/* Center Radar Dot */}
      <Circle cx="60" cy="60" r="2" fill="#FFFFFF"/>
    </Svg>
  );
};

export default YardRadarIcon;