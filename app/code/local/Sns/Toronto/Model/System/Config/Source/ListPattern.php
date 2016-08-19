<?php

class Sns_Toronto_Model_System_Config_Source_ListPattern
{
	public function toOptionArray()	{
		
		$arrPattern = array();
		$arrPattern[] = array('value'=>'pattern_0', 'label'=>Mage::helper('toronto')->__('pattern_0 - none image'));
		
		for($i=1; $i < 15; $i++){
			$arrPattern[] = array('value'=>'pattern_'.$i, 'label'=>Mage::helper('toronto')->__('pattern_'.$i));
		}
		
		return $arrPattern;
	}
}
