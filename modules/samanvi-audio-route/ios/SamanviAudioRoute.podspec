Pod::Spec.new do |s|
  s.name = 'SamanviAudioRoute'
  s.version = '1.0.0'
  s.summary = 'System media output observation for Samanvi Driver.'
  s.description = 'Local Expo module for system audio route changes.'
  s.author = 'Samanvi Travels'
  s.homepage = 'https://nagendrayakkaladevara.github.io/samanvi-travels-mobile-ux/'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation'
  s.swift_version = '5.9'
  s.source_files = '**/*.{h,m,mm,swift}'
end
