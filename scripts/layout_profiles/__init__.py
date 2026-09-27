from .base import UnsupportedLayout
from .ap_2017 import AP2017Profile
from .fa_2017 import FA2017Profile
from .wiso_2017 import WiSo2017Profile
from .ap_2017_18 import APWinterProfile

PROFILES = [AP2017Profile, FA2017Profile, WiSo2017Profile, APWinterProfile]
# Source allowlists are metadata, not dispatch by year/file name. Add another
# verified source to the same profile when its geometry/ownership rules match.
for cls in PROFILES:
    cls.validated_sources = ({'exam':cls.exam,'module':cls.module,'source_hash':cls.source_hash,
        'validation_status':'compatible' if cls.profile_id in ('ap_2017','fa_2017','wiso_2017') else 'blocked'},)

def profile_metadata():
    return [{'profile_id':cls.profile_id,'profile_version':cls.version,
             'validated_sources':list(cls.validated_sources)} for cls in PROFILES]

def select_profile(exam, module, source_hash):
    for cls in PROFILES:
        for source in cls.validated_sources:
            if (source['exam'],source['module'],source['source_hash']) == (exam,module,source_hash):
                profile=cls()
                profile.exam=exam;profile.module=module;profile.source_hash=source_hash
                return profile
    raise UnsupportedLayout('unsupported_layout: no exact validated source match')
