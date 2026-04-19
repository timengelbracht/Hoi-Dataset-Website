# Wiki: Dataset Structure and Recording Specification

This document describes the structure, nomenclature, synchronization, and coordinate conventions of the articulated manipulation dataset.

---

## Overview

Each **recording location** (e.g. kitchens, bathrooms, bedrooms) contains multiple **articulated objects** such as drawers, cabinets, dishwashers, etc.

For each location, we record **multiple manipulation schemes** and **multiple viewpoints**, and we additionally capture **laser scans** of both articulated and unarticulated states of the scene. All sensory data is temporally aligned and spatially registered to a common reference frame.

---

## Manipulation Schemes

Each location is recorded with the following **four manipulation schemes**:

1. Hoi! gripper
2. Human hand
3. Human hand with wrist-mounted camera
4. UMI gripper

For each manipulation scheme, multiple recording modules (sensors) are active simultaneously.

---

## Viewpoints

For each interaction, the following viewpoints may be present:

### Egocentric
- Project Aria (human mounted)

### Manipulation-centric
- Wrist-mounted Aria (if applicable)
- Gripper-mounted Aria (if applicable)
- UMI-mounted GoPro

### Exocentric
- 1–2 iPhone RGB-D viewpoints

### Static Reference
- Leica laser scanner (multiple scans per location)

---

## Spatial Registration

- All recordings are **spatially registered** to a **common reference frame**, defined by the **Leica laser scan**.
- Registration is performed using visual registration.
- Any directory with the suffix `_aligned` contains data already transformed into the Leica coordinate frame.
- All `_aligned` data within the same recording session lives in the **same global frame**.
- For UMI, `slam/` folder is aligned although it doesn't have the `_aligned` suffix. `odometry` is not aligned.

---

## Frames

- Some aligned Project Aria MPS outputs (directories with the `_aligned` suffix) contain column names ending in `_device` and `_world`.
  - `_device` indicates that the value is expressed in the **Aria device coordinate frame**.
  - `_world` indicates that the value is expressed in the **Leica reference frame**.
  - Additional details on Aria coordinate frames and conventions can be found in the
    [Project ARIA Tools — MPS documentation](https://facebookresearch.github.io/projectaria_tools/docs/ARK/mps).

- Values expressed in the Aria device frame can be transformed into the world (Leica) frame using the rigid transformations provided in the corresponding `calib/` directories.

We use the convention `p_A = T_A_B @ p_B`, i.e. `T_A_B` maps points from frame `B` into frame `A`.

For the Aria RGB calibration, `T_device_camera` stores the transform from the raw camera frame to the device frame.

The key `pinhole_T_device_camera` is a bit misleadingly named. In practice, it does not store the rectified-camera-to-device transform, but rather the transform from the rectified pinhole camera frame to the raw camera frame.

Therefore, the rectified-camera-to-device transform is obtained as:

`T_device_camRaw = aria_calibration["PINHOLE"]["T_device_camera"]`  
`T_camRaw_camRect = aria_calibration["PINHOLE"]["pinhole_T_device_camera"]  # name is misleading`  
`T_device_camRect = T_device_camRaw @ T_camRaw_camRect`

A clearer name for `pinhole_T_device_camera` would be `T_camRaw_camRect`.


**TODO:** Add more extensive explanations of the transformation chains and frame conventions.

### Important Coordinate Frames

The following coordinate frames are commonly used throughout the dataset:

- Rectified Aria RGB camera frame
- Raw Aria RGB camera frame
- Aria device frame
- Force–torque / IMU sensor frame
- ZED camera frames:
  - Left camera frame
  - Right camera frame
- Hoi! gripper tool center point (TCP) frame

---

## Temporal Alignment

- All recording modules within a single recording session are **time-aligned** (not hardware-synchronized).
- All samples carry a **nanosecond-resolution timestamp**.
- Different sensors may operate at different frame rates.

---

## Interaction Splitting

- Inside interaction_splitting_info_<interaction indices>.json the automatic splits (time windows) are stored
- Inside interaction_splitting_info_<interaction indices>_confirmed.json manually checked and with object index annoted windows are stored

---

## File Naming Conventions

### Frame Data
- Stored as `.jpg`
- File name format: `<timestamp>.jpg`

### Time-Series Data
- Stored as `.csv`
- Contains a column named exactly `timestamp`, which carries the aligned timestamp.
- Other columns that contain a similar name to timestamp (e.g. remnants of ROS messages like `header.stamp.nanosec` or Aria MPS `utc_timestamp_ns`) refer to the actual recording timestamp and are **NOT** aligned. Left for completeness only.

---

## Directory Structure

```
<recording_location>/
├── gripper/
│   ├── interaction_splitting_info_<interaction_indices>.json
│   ├── interaction_splitting_info_<interaction_indices>_confirmed.json
│   ├── aria_gripper/
│   │   └── <recording_location>_<interaction_indices>_gripper_vrs/
│   │       ├── anonymization.json
│   │       ├── statistics.json
│   │       ├── time_sync_info.json
│   │       ├── anonymization_cache/
│   │       ├── calib/
│   │       ├── camera_depth/
│   │       ├── camera_rgb/
│   │       ├── eye_gaze/
│   │       ├── hand_tracking/
│   │       ├── slam/
│   │       └── visual_registration/
│   ├── aria_human/
│   │   └── <recording_location>_<interaction_indices>_gripper_vrs/
│   │       └── (same general Aria structure as above)
│   ├── gripper/
│   │   └── <recording_location>_<interaction_indices>_gripper_bag/
│   │       ├── anonymization.json
│   │       ├── time_sync_info.json
│   │       ├── anonymization_cache/
│   │       ├── calib/
│   │       ├── digit/
│   │       ├── dynamixel_workbench/
│   │       ├── force_torque/
│   │       ├── gripper_force_trigger/
│   │       ├── tf_static/
│   │       └── zedm/
│   ├── iphone_1/ or iphone_1 (<color>)/
│   │   └── <recording_location>_<interaction_indices>_gripper/
│   │       ├── anonymization.json
│   │       ├── metadata
│   │       ├── statistics.json
│   │       ├── time_sync_info.json
│   │       ├── anonymization_cache/
│   │       ├── camera_depth/
│   │       ├── camera_rgb/
│   │       ├── poses/
│   │       ├── rgbd/
│   │       ├── visual_registration/
│   │       └── poses_aligned/ (if present)
│   └── iphone_2/ or iphone_2 (<color>)/
│       └── (same general iPhone structure as iphone_1)
├── hand/
│   ├── interaction_splitting_info_<interaction_indices>.json
│   ├── interaction_splitting_info_<interaction_indices>_confirmed.json
│   ├── aria_human/
│   │   └── <recording_location>_<interaction_indices>_hand_vrs/
│   │       └── (same general Aria structure; multi_slam/ may also be present)
│   ├── iphone_1/ or iphone_1 (<color>)/
│   │   └── <recording_location>_<interaction_indices>_hand/
│   │       └── (same general iPhone structure; poses_aligned/ may also be present)
│   └── iphone_2/ or iphone_2 (<color>)/
│       └── (same general iPhone structure as iphone_1)
├── leica/
│   ├── <recording_location>.json
│   ├── <setup>/
│   │   ├── images/
│   │   ├── points/
│   │   ├── points_downsampled/
│   │   ├── mesh/ (if present)
│   │   ├── pano_tiles/ (if present)
│   │   ├── instance_annotations/ (if present)
│   │   └── instance_annotations_3d/ (if present)
│   └── <additional setup directories>/
├── umi/
│   ├── interaction_splitting_info_<interaction_indices>.json
│   ├── interaction_splitting_info_<interaction_indices>_confirmed.json
│   ├── aria_human/
│   │   └── <recording_location>_<interaction_indices>_umi_vrs/
│   │       └── (same general Aria structure; multi_slam/ may also be present)
│   ├── iphone_1/
│   │   └── <recording_location>_<interaction_indices>_umi/
│   │       └── (same general iPhone structure as above)
│   ├── iphone_2/
│   │   └── <recording_location>_<interaction_indices>_umi/
│   │       └── (same general iPhone structure as above)
│   └── umi_gripper/
│       └── <recording_location>_<interaction_indices>_umi/
│           ├── anonymization.json
│           ├── time_sync_info.json
│           ├── anonymization_cache/
│           ├── calib/
│           ├── camera_rgb/
│           ├── odometry/
│           ├── slam/
│           ├── telemetry/
│           └── visual_registration/
└── wrist/
    ├── interaction_splitting_info_<interaction_indices>.json
    ├── interaction_splitting_info_<interaction_indices>_confirmed.json
    ├── aria_human/
    │   └── <recording_location>_<interaction_indices>_wrist_vrs/
    │       └── (same general Aria structure; multi_slam/ may also be present)
    ├── aria_wrist/
    │   └── <recording_location>_<interaction_indices>_wrist_vrs/
    │       └── (same general Aria structure as above)
    ├── iphone_1/
    │   └── <recording_location>_<interaction_indices>_wrist/
    │       └── (same general iPhone structure as above)
    └── iphone_2/
        └── <recording_location>_<interaction_indices>_wrist/
            └── (same general iPhone structure as above)

```

---

## Nomenclature

### Recording Location
`<recording_location> ::= bedroom_1 | bathroom_2 | kitchen_3 | ...`

### Recording Type
`<recording_type> ::= gripper | hand | wrist | umi`

### Recording Module
```
<recording_module> ::=
    gripper |
    umi |
    aria_human |
    aria_gripper |
    aria_wrist |
    iphone_1 |
    iphone_2
```

### Interaction Indices
`<interaction_indices> ::= 1-6 | 1-4 | 8-16 | 1-3-5-7 | ...`

Interaction indices indicate which articulated interactions are present in a recording session.

---

## Cross-Module Alignment

- All modules belonging to the same `<recording_location>_<interaction_indices>_<recording_type>` share:
  - A common time base
  - A common spatial alignment after registration
- No assumption of strict frame-to-frame synchronization should be made.

---

## Calibration Files (`calib/`)

Calibration folders may contain:
- Intrinsic camera parameters
- Camera-to-body extrinsics
- Sensor-to-sensor transformations
- Timestamp offset metadata (if applicable)

**TODO:** Fully describe the contents and conventions of all calibration files.

---

## CSV Files

CSV files may include (non-exhaustive):
- SLAM trajectories
- IMU measurements
- Eye gaze vectors
- Force–torque readings
- Motor states
- Trigger signals

All CSV files:
- Must include a `timestamp` column (nanoseconds)
- Are expressed in the sensor's native frame unless `_aligned`

**TODO:** Describe the schema of each CSV file type in detail.

---

## Notes

- `_aligned` directories indicate data already transformed into the Leica frame.
- Raw (non-aligned) data is preserved whenever possible.
- Multiple Leica scans per location allow capturing both articulated and unarticulated states.

**TODO:** Provide data loader
