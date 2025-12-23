#!/bin/bash

# Weekly Grind - Test Data Generator
# Creates realistic test projects and assigns stages to actual users

set -e

API_BASE="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Weekly Grind - Test Data Generator${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# User IDs from your database
ADMIN_ID=1        # admin
JOSH_ID=2         # josh.calhoun (tech)
MATT_ID=3         # matt.copple (supervisor)
BRIAN_ID=4        # brian.brodeur (manager)
SHANNON_ID=5      # shannon.buchanan (coordinator)
BLYTHE_ID=6       # blythe.sousa (tech)

# Tech users for assignment
TECHS=($JOSH_ID $BLYTHE_ID)

echo -e "${YELLOW}Creating test projects with stage assignments...${NC}"
echo ""

# Project 1: Large Enterprise Deployment
echo -e "${BLUE}Project 1: Enterprise Deployment (ACME Corp)${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "ACME-2025-001",
    "client_id": "ACME-CORP",
    "project_name": "ACME Enterprise Desktop Refresh",
    "description": "Complete desktop replacement for headquarters - 150 machines",
    "date_project_opened": "2025-11-15",
    "status": "open",
    "customer_temp": 4,
    "num_desktops": 120,
    "num_laptops": 30,
    "num_images": 3,
    "onsite_or_ship": "onsite",
    "onsite_scheduled": true,
    "onsite_date": "2025-12-20",
    "hardware_eta": "2025-11-25",
    "notes": "High priority - CEO visibility"
  }' | jq -r '.pid' || echo "Created"

# Assign stages to Josh, Blythe, Josh
curl -s -X POST "${API_BASE}/api/projects/ACME-2025-001/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 14}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/ACME-2025-001/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 2, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 7}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/ACME-2025-001/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 3, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 5}" > /dev/null

echo -e "${GREEN}? Created ACME-2025-001 (Josh ? Blythe ? Josh)${NC}"

# Project 2: Small Office Setup
echo -e "${BLUE}Project 2: Small Office Setup${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "SMITH-LAW-2025-002",
    "client_id": "SMITH-LAW",
    "project_name": "Smith & Associates Law Office Setup",
    "description": "New office buildout - 12 workstations",
    "date_project_opened": "2025-11-20",
    "status": "open",
    "customer_temp": 2,
    "num_desktops": 10,
    "num_laptops": 2,
    "num_images": 1,
    "onsite_or_ship": "ship",
    "date_hardware_received": "2025-11-22",
    "notes": "Standard config, rush delivery requested"
  }' | jq -r '.pid' || echo "Created"

# Assign all stages to Blythe
curl -s -X POST "${API_BASE}/api/projects/SMITH-LAW-2025-002/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 5}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/SMITH-LAW-2025-002/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 2, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 3}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/SMITH-LAW-2025-002/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 3, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 2}" > /dev/null

echo -e "${GREEN}? Created SMITH-LAW-2025-002 (Blythe ? Blythe ? Blythe)${NC}"

# Project 3: Medical Office - Critical
echo -e "${BLUE}Project 3: Medical Office Upgrade (Critical)${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "HEALTH-FIRST-2025-003",
    "client_id": "HEALTH-FIRST",
    "project_name": "HealthFirst Clinic HIPAA Compliance Upgrade",
    "description": "Security upgrade for medical records workstations",
    "date_project_opened": "2025-11-10",
    "status": "open",
    "customer_temp": 5,
    "num_desktops": 25,
    "num_laptops": 8,
    "num_images": 2,
    "onsite_or_ship": "onsite",
    "onsite_scheduled": true,
    "onsite_date": "2025-12-05",
    "date_hardware_received": "2025-11-18",
    "hardware_eta": "2025-11-18",
    "contact_method": "call",
    "date_last_contacted": "2025-11-27",
    "notes": "HIPAA compliance critical - encryption required on all devices"
  }' | jq -r '.pid' || echo "Created"

# Assign stages - Josh handles IMG/CFG and deployment for security
curl -s -X POST "${API_BASE}/api/projects/HEALTH-FIRST-2025-003/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 10}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/HEALTH-FIRST-2025-003/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 2, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 5}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/HEALTH-FIRST-2025-003/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 3, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 3}" > /dev/null

echo -e "${GREEN}? Created HEALTH-FIRST-2025-003 (Josh ? Blythe ? Josh)${NC}"

# Project 4: Manufacturing Floor - In Progress
echo -e "${BLUE}Project 4: Manufacturing Floor Terminals${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "TECHMFG-2025-004",
    "client_id": "TECH-MFG",
    "project_name": "TechMfg Production Floor Terminals",
    "description": "Ruggedized workstations for factory floor",
    "date_project_opened": "2025-11-01",
    "status": "open",
    "customer_temp": 3,
    "num_desktops": 40,
    "num_laptops": 0,
    "num_images": 1,
    "onsite_or_ship": "mixed",
    "date_hardware_received": "2025-11-08",
    "contact_method": "email",
    "date_last_contacted": "2025-11-25",
    "notes": "Dust-resistant cases, custom mounting brackets needed"
  }' | jq -r '.pid' || echo "Created"

# All Blythe for manufacturing expertise
curl -s -X POST "${API_BASE}/api/projects/TECHMFG-2025-004/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 12}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/TECHMFG-2025-004/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 2, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 6}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/TECHMFG-2025-004/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 3, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 4}" > /dev/null

echo -e "${GREEN}? Created TECHMFG-2025-004 (Blythe ? Blythe ? Blythe)${NC}"

# Project 5: School District - Large Scale
echo -e "${BLUE}Project 5: School District Deployment${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "SCHOOL-DIST-2025-005",
    "client_id": "USD-CENTRAL",
    "project_name": "Central School District Chromebook Deployment",
    "description": "Student laptops for 3 elementary schools",
    "date_project_opened": "2025-11-18",
    "status": "open",
    "customer_temp": 2,
    "num_desktops": 0,
    "num_laptops": 200,
    "num_images": 1,
    "onsite_or_ship": "ship",
    "hardware_eta": "2025-12-01",
    "notes": "Education pricing applied, deliver before winter break"
  }' | jq -r '.pid' || echo "Created"

# Split between Josh and Blythe
curl -s -X POST "${API_BASE}/api/projects/SCHOOL-DIST-2025-005/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 8}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/SCHOOL-DIST-2025-005/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 2, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 4}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/SCHOOL-DIST-2025-005/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 3, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 3}" > /dev/null

echo -e "${GREEN}? Created SCHOOL-DIST-2025-005 (Josh ? Josh ? Blythe)${NC}"

# Project 6: Financial Services - Security Focus
echo -e "${BLUE}Project 6: Financial Services Security Upgrade${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "BANKCORP-2025-006",
    "client_id": "BANKCORP",
    "project_name": "BankCorp Secure Workstation Rollout",
    "description": "Encrypted workstations with biometric auth",
    "date_project_opened": "2025-11-25",
    "status": "open",
    "customer_temp": 5,
    "num_desktops": 35,
    "num_laptops": 15,
    "num_images": 2,
    "onsite_or_ship": "onsite",
    "onsite_scheduled": false,
    "hardware_eta": "2025-12-05",
    "contact_method": "meeting",
    "date_last_contacted": "2025-11-27",
    "notes": "Requires PCI compliance certification, fingerprint readers on all units"
  }' | jq -r '.pid' || echo "Created"

# Josh for security-focused work
curl -s -X POST "${API_BASE}/api/projects/BANKCORP-2025-006/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 15}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/BANKCORP-2025-006/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 2, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 8}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/BANKCORP-2025-006/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 3, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 5}" > /dev/null

echo -e "${GREEN}? Created BANKCORP-2025-006 (Josh ? Josh ? Josh)${NC}"

# Project 7: Startup - Quick Turnaround
echo -e "${BLUE}Project 7: Tech Startup Office${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "INNOVATE-2025-007",
    "client_id": "INNOVATE-TECH",
    "project_name": "Innovate Tech New Office Setup",
    "description": "Developer workstations for growing startup",
    "date_project_opened": "2025-11-28",
    "status": "open",
    "customer_temp": 3,
    "num_desktops": 15,
    "num_laptops": 10,
    "num_images": 1,
    "onsite_or_ship": "ship",
    "date_hardware_received": "2025-11-29",
    "notes": "High-spec machines for developers, dual monitors"
  }' | jq -r '.pid' || echo "Created"

# Quick project - Blythe handles all
curl -s -X POST "${API_BASE}/api/projects/INNOVATE-2025-007/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 6}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/INNOVATE-2025-007/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 2, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 3}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/INNOVATE-2025-007/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 3, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 2}" > /dev/null

echo -e "${GREEN}? Created INNOVATE-2025-007 (Blythe ? Blythe ? Blythe)${NC}"

# Project 8: On Hold - Waiting for Hardware
echo -e "${BLUE}Project 8: Restaurant Chain (On Hold)${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "FOODCHAIN-2025-008",
    "client_id": "FOOD-CHAIN",
    "project_name": "FoodChain POS System Upgrade",
    "description": "Point of sale terminals across 8 locations",
    "date_project_opened": "2025-11-12",
    "status": "on_hold",
    "customer_temp": 2,
    "num_desktops": 32,
    "num_laptops": 0,
    "num_images": 1,
    "onsite_or_ship": "onsite",
    "hardware_eta": "2025-12-15",
    "notes": "Waiting on specialized POS hardware - delayed shipment"
  }' | jq -r '.pid' || echo "Created"

# Assigned but on hold
curl -s -X POST "${API_BASE}/api/projects/FOODCHAIN-2025-008/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 10}" > /dev/null

echo -e "${GREEN}? Created FOODCHAIN-2025-008 (On Hold - Josh assigned)${NC}"

# Project 9: Completed Project (for reference)
echo -e "${BLUE}Project 9: Completed Archive Project${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "OLDCORP-2025-009",
    "client_id": "OLD-CORP",
    "project_name": "OldCorp Desktop Refresh (Completed)",
    "description": "Completed project for testing purposes",
    "date_project_opened": "2025-10-01",
    "status": "complete",
    "customer_temp": 1,
    "num_desktops": 20,
    "num_laptops": 5,
    "num_images": 1,
    "onsite_or_ship": "ship",
    "date_hardware_received": "2025-10-05",
    "notes": "Successfully completed and deployed"
  }' | jq -r '.pid' || echo "Created"

curl -s -X POST "${API_BASE}/api/projects/OLDCORP-2025-009/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 7}" > /dev/null

echo -e "${GREEN}? Created OLDCORP-2025-009 (Completed)${NC}"

# Project 10: Remote Work Setup
echo -e "${BLUE}Project 10: Remote Work Setup${NC}"
curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "pid": "REMOTE-TEAM-2025-010",
    "client_id": "REMOTE-WORK",
    "project_name": "Remote Team Equipment Distribution",
    "description": "Home office setups for distributed team",
    "date_project_opened": "2025-11-22",
    "status": "open",
    "customer_temp": 3,
    "num_desktops": 0,
    "num_laptops": 45,
    "num_images": 1,
    "onsite_or_ship": "ship",
    "date_hardware_received": "2025-11-26",
    "contact_method": "email",
    "date_last_contacted": "2025-11-26",
    "notes": "Ship to individual addresses nationwide, VPN pre-configured"
  }' | jq -r '.pid' || echo "Created"

# Split between techs
curl -s -X POST "${API_BASE}/api/projects/REMOTE-TEAM-2025-010/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 1, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 9}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/REMOTE-TEAM-2025-010/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 2, \"assigned_tech_id\": $JOSH_ID, \"planned_duration_days\": 5}" > /dev/null

curl -s -X POST "${API_BASE}/api/projects/REMOTE-TEAM-2025-010/stages" \
  -H "Content-Type: application/json" \
  -d "{\"stage_definition_id\": 3, \"assigned_tech_id\": $BLYTHE_ID, \"planned_duration_days\": 3}" > /dev/null

echo -e "${GREEN}? Created REMOTE-TEAM-2025-010 (Blythe ? Josh ? Blythe)${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}? Test Data Generation Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Created 10 test projects:"
echo ""
echo "  1. ACME-2025-001          - Enterprise (150 machines) - HIGH PRIORITY"
echo "  2. SMITH-LAW-2025-002     - Small Office (12 machines)"
echo "  3. HEALTH-FIRST-2025-003  - Medical HIPAA Upgrade - CRITICAL"
echo "  4. TECHMFG-2025-004       - Manufacturing Floor (40 terminals)"
echo "  5. SCHOOL-DIST-2025-005   - School Laptops (200 units)"
echo "  6. BANKCORP-2025-006      - Financial Security - CRITICAL"
echo "  7. INNOVATE-2025-007      - Startup Quick Setup"
echo "  8. FOODCHAIN-2025-008     - Restaurant POS (ON HOLD)"
echo "  9. OLDCORP-2025-009       - Completed Project"
echo "  10. REMOTE-TEAM-2025-010  - Remote Work Distribution"
echo ""
echo "Stage assignments:"
echo "  • Josh Calhoun: 6 projects (mostly security/critical)"
echo "  • Blythe Sousa: 7 projects (varied workload)"
echo "  • Mixed assignments: 4 projects"
echo ""
echo "Project statuses:"
echo "  • Open: 8 projects"
echo "  • On Hold: 1 project"
echo "  • Complete: 1 project"
echo ""
echo "Customer temperatures:"
echo "  • Temp 5 (Hot): 2 projects"
echo "  • Temp 4: 1 project"
echo "  • Temp 3: 4 projects"
echo "  • Temp 2: 3 projects"
echo ""
echo "Next steps:"
echo "  1. View projects: http://localhost:3000/weekly-grind/projects"
echo "  2. Edit any project to see stage assignments"
echo "  3. Check tech workload distribution"
echo ""
echo -e "${YELLOW}Tip: Click any PID to see the stage management section!${NC}"
echo ""